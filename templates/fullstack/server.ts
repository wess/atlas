import { config } from "./src/config.ts"
import { serve } from "@atlas/server"
import { userRoutes } from "./src/routes/users.ts"
import index from "./index.html"

serve({
  port: config.port,
  routes: [
    ...userRoutes,
  ],
  static: {
    "/": index,
  },
})

console.log(`Server running on :${config.port}`)
