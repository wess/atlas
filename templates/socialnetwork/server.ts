import { serve } from "@atlas/server"
import { admin, model } from "@atlas/admin"
import { config } from "./src/config.ts"
import { db } from "./src/db.ts"
import { users, posts, follows, likes, media } from "./src/schema.ts"
import { healthRoutes } from "./src/routes/health.ts"
import { authRoutes } from "./src/routes/auth.ts"
import { userRoutes } from "./src/routes/users.ts"
import { postRoutes } from "./src/routes/posts.ts"
import { feedRoutes } from "./src/routes/feed.ts"
import { mediaRoutes } from "./src/routes/media.ts"
import { feedEventRoutes } from "./src/events/feed.ts"
import { wsConfig } from "./src/channels/notifications.ts"

const adm = admin({
  db,
  models: [
    model(users),
    model(posts),
    model(follows),
    model(likes),
    model(media),
  ],
  auth: { secret: config.auth.secret },
})

serve({
  port: config.port,
  routes: [
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
