import { router } from "@atlas/server"
import index from "./index.html"
import { config } from "./src/config.ts"
import { userRoutes } from "./src/routes/users.ts"

const api = router(...userRoutes)

const server = Bun.serve({
  port: config.port,
  routes: {
    "/api/*": api,
    "/*": index,
  },
})

console.log(`Server running on ${server.url}`)
