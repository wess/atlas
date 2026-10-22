import { admin, model } from "@wess/atlas/admin"
import { migrate } from "@wess/atlas/migrate"
import { get, pipe, putHeader, serve, text } from "@wess/atlas/server"
import { config } from "./src/config.ts"
import { db } from "./src/db.ts"
import { authRoutes } from "./src/routes/auth.ts"
import { deliveryRoutes } from "./src/routes/delivery.ts"
import { entryRoutes } from "./src/routes/entries.ts"
import { healthRoutes } from "./src/routes/health.ts"
import { keyRoutes } from "./src/routes/keys.ts"
import { mediaRoutes } from "./src/routes/media.ts"
import { revisionRoutes } from "./src/routes/revisions.ts"
import { typeRoutes } from "./src/routes/types.ts"
import { webhookRoutes } from "./src/routes/webhooks.ts"
import { apiKeys, contentTypes, entries, media, revisions, users, webhooks } from "./src/schema.ts"

await migrate.up(db, "./migrations")

// Auto-generated CRUD panel from @wess/atlas/admin, mounted away from the CMS's own
// /admin/api/* routes so the two APIs never collide.
const panel = admin({
  db,
  basePath: "/panel",
  models: [
    model({ schema: users }),
    model({ schema: contentTypes }),
    model({ schema: entries }),
    model({ schema: media }),
    model({ schema: apiKeys }),
    model({ schema: revisions }),
    model({ schema: webhooks }),
  ],
  auth: { secret: config.auth.secret, authorize: (claims) => claims.role === "admin" },
})

const page = await Bun.file(new URL("./index.html", import.meta.url).pathname).text()
const home = get(
  "/",
  pipe((c) => putHeader(text(c, 200, page), "content-type", "text/html; charset=utf-8")),
)

serve({
  maxRequestBodySize: 16 * 1024 * 1024,
  port: config.port,
  hostname: config.host,
  routes: [
    home,
    ...healthRoutes,
    ...authRoutes,
    ...typeRoutes,
    ...entryRoutes,
    ...mediaRoutes,
    ...revisionRoutes,
    ...keyRoutes,
    ...webhookRoutes,
    ...deliveryRoutes,
    ...panel.routes,
  ],
})

console.log(`Server running on :${config.port}`)
