import { defineConfig, env } from "@atlas/config"
import { connect } from "@atlas/db"
import { migrate } from "@atlas/migrate"
import { serve } from "@atlas/server"
import { authRoutes } from "./routes/auth.ts"
import { postRoutes } from "./routes/posts.ts"
import { timelineRoutes } from "./routes/timeline.ts"
import { socialRoutes } from "./routes/social.ts"

const config = defineConfig({
  port: env("PORT", { parse: Number, default: "3000" }),
  secret: env("SECRET", { default: "dev-secret" }),
})

const db = connect({ driver: "sqlite", path: "./chirp.db" })

await migrate.up(db, "./migrations")

serve({
  port: config.port,
  routes: [
    ...authRoutes(db, config.secret),
    ...postRoutes(db, config.secret),
    ...timelineRoutes(db, config.secret),
    ...socialRoutes(db, config.secret),
  ],
})

console.log(`chirp running on http://localhost:${config.port}`)
