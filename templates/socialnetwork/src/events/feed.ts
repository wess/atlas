import { get } from "@atlas/server"
import { db } from "../db.ts"
import { authed } from "../pipes/auth.ts"

export const feedEventRoutes = [
  get("/api/feed/stream", authed(
    async (c) => {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()

          const send = (data: unknown) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          }

          const interval = setInterval(async () => {
            try {
              const rows = await db.query(
                `select p.id, p.user_id, p.content, p.image_url, p.created_at,
                  u.username, u.name, u.avatar_url
                 from posts p
                 join users u on u.id = p.user_id
                 where p.user_id in (
                   select following_id from follows where follower_id = $1
                 )
                 order by p.created_at desc
                 limit 5`,
                [c.auth.userId],
              )
              send({ type: "feed_update", posts: rows })
            } catch {
              // connection may have closed
            }
          }, 10000)

          c.req.signal.addEventListener("abort", () => {
            clearInterval(interval)
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
    },
  )),
]
