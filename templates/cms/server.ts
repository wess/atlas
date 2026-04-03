import { serve } from "@atlas/server"
import { admin, model } from "@atlas/admin"
import { config } from "./src/config.ts"
import { db } from "./src/db.ts"
import { users, contentTypes, entries, media, apiKeys, revisions, webhooks } from "./src/schema.ts"
import { healthRoutes } from "./src/routes/health.ts"
import { authRoutes } from "./src/routes/auth.ts"
import { typeRoutes } from "./src/routes/types.ts"
import { entryRoutes } from "./src/routes/entries.ts"
import { mediaRoutes } from "./src/routes/media.ts"
import { revisionRoutes } from "./src/routes/revisions.ts"
import { keyRoutes } from "./src/routes/keys.ts"
import { webhookRoutes } from "./src/routes/webhooks.ts"
import { deliveryRoutes } from "./src/routes/delivery.ts"

const adm = admin({
  db,
  models: [
    model(users),
    model(contentTypes),
    model(entries),
    model(media),
    model(apiKeys),
    model(revisions),
    model(webhooks),
  ],
  auth: { secret: config.auth.secret },
})

serve({
  port: config.port,
  routes: [
    ...healthRoutes,
    ...authRoutes,
    ...typeRoutes,
    ...entryRoutes,
    ...mediaRoutes,
    ...revisionRoutes,
    ...keyRoutes,
    ...webhookRoutes,
    ...deliveryRoutes,
    ...adm.routes,
  ],
})

console.log(`Server running on :${config.port}`)
