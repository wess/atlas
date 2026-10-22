import { defineConfig, env } from "@wess/atlas/config"
import { connect } from "@wess/atlas/db/sqlite";
import { migrate } from "@wess/atlas/migrate"
import { router } from "@wess/atlas/server"
import index from "./web/index.html"
import { authRoutes } from "./routes/auth.ts"
import { postRoutes } from "./routes/posts.ts"
import { timelineRoutes } from "./routes/timeline.ts"
import { socialRoutes } from "./routes/social.ts"

const config = defineConfig({
  port: env("PORT", { parse: Number, default: "3000" }),
  secret: env("SECRET", { parse: (value) => {
    if (value.length < 32) throw new Error("SECRET must contain at least 32 random characters");
    return value;
  } }),
})

const isDev = (process.env.NODE_ENV ?? "development") === "development"

const db = connect({ driver: "sqlite", path: "./chirp.db" })

await migrate.up(db, "./migrations")

const api = router(
  ...authRoutes(db, config.secret),
  ...postRoutes(db, config.secret),
  ...timelineRoutes(db, config.secret),
  ...socialRoutes(db, config.secret),
)

// Mount the route modules under /api. Their patterns stay mount-agnostic
// (/posts, /login, …), so strip the prefix before handing off to the router.
const apiHandler = (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  url.pathname = url.pathname.replace(/^\/api/, "") || "/"
  return api(new Request(url.toString(), req))
}

const server = Bun.serve({
  port: config.port,
  hostname: "0.0.0.0",
  development: isDev ? { hmr: true, console: true } : false,
  routes: {
    "/api/*": apiHandler,
    "/*": index,
  },
})

console.log(`chirp running on ${server.url}`)
