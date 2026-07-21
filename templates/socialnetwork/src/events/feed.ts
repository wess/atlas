import { from, raw } from "@atlas/db"
import { get } from "@atlas/server"
import { eventStream } from "@atlas/server/sse"
import { db } from "../db.ts"
import { currentUserId, guard } from "../pipes/auth.ts"

const pollInterval = 10_000

const latestFromFollowed = (userId: number) =>
  from("posts", "p")
    .join("users", "u.id = p.userId", "u")
    .select("p.id", "p.userId", "p.content", "p.imageUrl", "p.createdAt", "u.username", "u.name", "u.avatarUrl")
    .where((q) => q.raw(raw("p.userId in (select followingId from follows where followerId = $1)", userId)))
    .orderBy("p.createdAt", "DESC")
    .limit(5)

export const feedEventRoutes = [
  get(
    "/api/feed/stream",
    guard((c) =>
      eventStream(c, async (send) => {
        const userId = currentUserId(c)

        while (!c.request.signal.aborted) {
          try {
            send("feed", await db.all(latestFromFollowed(userId)))
          } catch {
            break
          }
          await new Promise((resolve) => setTimeout(resolve, pollInterval))
        }
      }),
    ),
  ),
]
