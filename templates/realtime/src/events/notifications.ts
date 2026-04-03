import type { Context } from "@atlas/server"

export const notificationStream = (c: Context): Response => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      // Send a welcome event
      send("Connected to notification stream")

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        send("heartbeat")
      }, 30000)

      // Clean up on close
      c.req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
