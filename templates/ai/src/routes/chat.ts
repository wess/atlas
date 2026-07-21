import type { Message } from "@atlas/ai"
import { from } from "@atlas/db"
import { get, internal, json, pipe, post, putHeader, stream } from "@atlas/server"
import { ai } from "../ai.ts"
import { db } from "../db.ts"
import { conversations } from "../schema.ts"

const systemPrompt = "You are a helpful assistant. Be concise and informative."

const sseHeaders = (c: Parameters<typeof putHeader>[0]) =>
  putHeader(
    putHeader(putHeader(c, "content-type", "text/event-stream"), "cache-control", "no-cache"),
    "connection",
    "keep-alive",
  )

export const chatRoutes = [
  post("/api/chat", pipe(async (c) => {
    const body = (await c.request.json()) as { message: string; conversationId?: number }
    const { message, conversationId } = body

    const existing = conversationId
      ? await db.one(
          from(conversations).select("id", "messages").where(q => q("id").equals(conversationId)),
        )
      : null

    const history: Message[] = existing ? JSON.parse(existing.messages) : []
    const messages: Message[] = [...history, { role: "user", content: message }]
    const serialized = JSON.stringify(messages)

    let convId: number
    if (existing) {
      convId = existing.id
      await db.execute(
        from(conversations)
          .where(q => q("id").equals(convId))
          .update({ messages: serialized, updated_at: new Date().toISOString() }),
      )
    } else {
      const rows = await db.execute(
        from(conversations).insert({ title: message.slice(0, 80), messages: serialized }).returning("id"),
      )
      const row = rows[0]
      if (!row) throw internal("Failed to create conversation")
      convId = row.id
    }

    const chatStream = ai.chatStream({
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    })

    const encoder = new TextEncoder()
    const sseStream = new ReadableStream({
      async start(controller) {
        let fullContent = ""
        try {
          for await (const chunk of chatStream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
            if (chunk.type === "text" && chunk.content) fullContent += chunk.content
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()

          const withReply: Message[] = [...messages, { role: "assistant", content: fullContent }]
          await db.execute(
            from(conversations)
              .where(q => q("id").equals(convId))
              .update({ messages: JSON.stringify(withReply), updated_at: new Date().toISOString() }),
          )
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return stream(sseHeaders(c), 200, sseStream)
  })),

  get("/api/conversations", pipe(async (c) => {
    const rows = await db.all(
      from(conversations).select("id", "title", "created_at", "updated_at").orderBy("updated_at", "DESC"),
    )
    return json(c, 200, rows)
  })),

  get("/api/conversations/:id", pipe(async (c) => {
    const conv = await db.one(
      from(conversations).where(q => q("id").equals(Number(c.params.id))),
    )
    if (!conv) return json(c, 404, { error: "Conversation not found" })
    return json(c, 200, { ...conv, messages: JSON.parse(conv.messages) })
  })),
]
