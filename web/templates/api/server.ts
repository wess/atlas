import { config } from "./src/config.ts"
import { serve } from "@atlas/server"
import { healthRoutes } from "./src/routes/health.ts"
import { userRoutes } from "./src/routes/users.ts"

serve({
  port: config.port,
  routes: [
    ...healthRoutes,
    ...userRoutes,
  ],
})

console.log(`Server running on :${config.port}`)
