import { admin, model } from "@wess/atlas/admin"
import { hash, verify } from "@wess/atlas/auth/password"
import { migrate } from "@wess/atlas/migrate"
import { get, pipe, putHeader, serve, text } from "@wess/atlas/server"
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

// set ADMIN_EMAIL and ADMIN_PASSWORD to turn on the admin sign-in screen
const adminPassword = config.adminEmail && config.adminPassword ? await hash(config.adminPassword) : null

const adm = admin({
  db,
  models: [
    model({ schema: users }),
    model({ schema: posts }),
    model({ schema: follows }),
    model({ schema: likes }),
    model({ schema: media }),
  ],
  auth: {
    secret: config.auth.secret,
    authorize: (claims) => claims.admin === true,
    login: adminPassword
      ? async ({ email, password }) =>
          email === config.adminEmail && (await verify(password, adminPassword)) ? { admin: true } : null
      : undefined,
  },
})

const page = await Bun.file(new URL("./index.html", import.meta.url).pathname).text()
const shell = pipe((c) => putHeader(text(c, 200, page), "content-type", "text/html; charset=utf-8"))

serve({
  maxRequestBodySize: 16 * 1024 * 1024,
  port: config.port,
  hostname: config.host,
  routes: [
    get("/", shell),
    get("/app/*", shell),
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
