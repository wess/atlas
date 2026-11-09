import type { Message } from "@wess/atlas/ai"
import { from } from "@wess/atlas/db/query";
import { get, internal, json, post, putHeader, stream } from "@wess/atlas/server"
import { ai } from "../ai.ts"
import { db } from "../db.ts"
import { authed, currentUserId, guard } from "../pipes/auth.ts"
import { conversations } from "../schema.ts"

const systemPrompt = "You are a helpful assistant. Be concise and informative."

const sseHeaders = (c: Parameters<typeof putHeader>[0]) =>
  putHeader(
    putHeader(putHeader(c, "content-type", "text/event-stream"), "cache-control", "no-cache"),
    "connection",
    "keep-alive",
  )

export const chatRoutes = [
  post("/api/chat", authed(async (c) => {
    const userId = currentUserId(c)
    const { message, conversationId } = (c.body ?? {}) as { message?: string; conversationId?: number }

    if (!message) return json(c, 400, { error: "message is required" })

    // Only the account that started a conversation can continue it.
    const existing = conversationId
      ? await db.one(
          from(conversations)
            .select("id", "messages")
            .where(q => q("id").equals(conversationId))
            .where(q => q("user_id").equals(userId)),
        )
      : null
    if (conversationId && !existing) return json(c, 404, { error: "Conversation not found" })

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
        from(conversations).insert({ user_id: userId, title: message.slice(0, 80), messages: serialized }).returning("id"),
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

  get("/api/conversations", guard(async (c) => {
    const rows = await db.all(
      from(conversations)
        .select("id", "title", "created_at", "updated_at")
        .where(q => q("user_id").equals(currentUserId(c)))
        .orderBy("updated_at", "DESC"),
    )
    return json(c, 200, rows)
  })),

  get("/api/conversations/:id", guard(async (c) => {
    const conv = await db.one(
      from(conversations)
        .where(q => q("id").equals(Number(c.params.id)))
        .where(q => q("user_id").equals(currentUserId(c))),
    )
    if (!conv) return json(c, 404, { error: "Conversation not found" })
    return json(c, 200, { ...conv, messages: JSON.parse(conv.messages) })
  })),
]
