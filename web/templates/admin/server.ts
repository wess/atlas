import { admin, model } from "@wess/atlas/admin"
import { serve } from "@wess/atlas/server"
import { config } from "./src/config.ts"
import { db } from "./src/db.ts"
import { apiRoutes } from "./src/routes/api.ts"
import { posts, users } from "./src/schema.ts"

const panel = admin({
  db,
  basePath: "/admin",
  auth: { secret: config.authSecret, authorize: (claims) => claims.role === "admin" },
  models: [
    model({ schema: users, searchFields: ["email", "name"], filterFields: ["role"] }),
    model({ schema: posts, searchFields: ["title"], filterFields: ["published"] }),
  ],
})

serve({
  port: config.port,
  routes: [...apiRoutes, ...panel.routes],
})

console.log(`Server running on :${config.port}`)
console.log(`Admin panel at http://localhost:${config.port}/admin`)
