import { admin, model } from "@atlas/admin"
import { migrate } from "@atlas/migrate"
import { get, pipe, putHeader, serve, text } from "@atlas/server"
import { wsConfig } from "./src/channels/notifications.ts"
import { config } from "./src/config.ts"
import { db } from "./src/db.ts"
import { feedEventRoutes } from "./src/events/feed.ts"
import { authRoutes } from "./src/routes/auth.ts"
import { feedRoutes } from "./src/routes/feed.ts"
import { healthRoutes } from "./src/routes/health.ts"
import { mediaRoutes } from "./src/routes/media.ts"
import { postRoutes } from "./src/routes/posts.ts"
import { userRoutes } from "./src/routes/users.ts"
import { follows, likes, media, posts, users } from "./src/schema.ts"

await migrate.up(db, "./migrations")

const adm = admin({
  db,
  models: [
    model({ schema: users }),
    model({ schema: posts }),
    model({ schema: follows }),
    model({ schema: likes }),
    model({ schema: media }),
  ],
  auth: { secret: config.auth.secret },
})

const page = await Bun.file(new URL("./index.html", import.meta.url).pathname).text()
const home = get(
  "/",
  pipe((c) => putHeader(text(c, 200, page), "content-type", "text/html; charset=utf-8")),
)

serve({
  port: config.port,
  hostname: config.host,
  routes: [
    home,
    ...healthRoutes,
    ...authRoutes,
    ...userRoutes,
    ...postRoutes,
    ...feedRoutes,
    ...mediaRoutes,
    ...feedEventRoutes,
    ...adm.routes,
  ],
  websocket: wsConfig,
})

console.log(`Server running on :${config.port}`)
