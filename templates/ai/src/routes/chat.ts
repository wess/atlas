import { get, post, pipe, json, stream, putHeader } from "@atlas/server"
import { ai } from "../ai.ts"
import { db } from "../db.ts"
import type { StreamChunk } from "@atlas/ai"

const systemPrompt = "You are a helpful assistant. Be concise and informative."

export const chatRoutes = [
  post("/api/chat", pipe(async (c) => {
    const body = await c.request.json()
    const { message, conversationId } = body as { message: string; conversationId?: number }

    let messages: { role: string; content: string }[] = []
    let convId = conversationId

    if (convId) {
      const rows = await db.query(
        "select id, title, messages from conversations where id = $1",
        [convId],
      )
      if (rows.length > 0) {
        messages = JSON.parse(rows[0].messages as string)
      }
    }

    messages.push({ role: "user", content: message })

    if (!convId) {
      const title = message.slice(0, 80)
      const rows = await db.query(
        "insert into conversations (title, messages) values ($1, $2) returning id",
        [title, JSON.stringify(messages)],
      )
      convId = rows[0].id as number
    } else {
      await db.query(
        "update conversations set messages = $1, updated_at = current_timestamp where id = $2",
        [JSON.stringify(messages), convId],
      )
    }

    const chatStream = ai.chatStream({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    })

    const savedConvId = convId
    const savedMessages = messages

    const sseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let fullContent = ""
        try {
          for await (const chunk of chatStream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
            if (chunk.type === "text" && chunk.content) fullContent += chunk.content
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()

          savedMessages.push({ role: "assistant", content: fullContent })
          await db.query(
            "update conversations set messages = $1, updated_at = current_timestamp where id = $2",
            [JSON.stringify(savedMessages), savedConvId],
          )
        } catch (err) {
          controller.error(err)
        }
      },
    })

    const conn = putHeader(c, "content-type", "text/event-stream")
    const conn2 = putHeader(conn, "cache-control", "no-cache")
    const conn3 = putHeader(conn2, "connection", "keep-alive")
    return stream(conn3, 200, sseStream)
  })),

  get("/api/conversations", pipe(async (c) => {
    const rows = await db.query(
      "select id, title, created_at, updated_at from conversations order by updated_at desc",
    )
    return json(c, 200, rows)
  })),

  get("/api/conversations/:id", pipe(async (c) => {
    const rows = await db.query(
      "select id, title, messages, created_at, updated_at from conversations where id = $1",
      [c.params.id],
    )
    if (rows.length === 0) return json(c, 404, { error: "Conversation not found" })
    const conv = rows[0]
    return json(c, 200, { ...conv, messages: JSON.parse(conv.messages as string) })
  })),
]
