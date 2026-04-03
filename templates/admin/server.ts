import { config } from "./src/config.ts"
import { serve } from "@atlas/server"
import { createAdmin } from "@atlas/admin"
import { db } from "./src/db.ts"
import { users, posts } from "./src/schema.ts"
import { apiRoutes } from "./src/routes/api.ts"

const admin = createAdmin({
  db,
  basePath: "/admin",
  resources: [
    { schema: users, label: "Users" },
    { schema: posts, label: "Posts" },
  ],
})

serve({
  port: config.port,
  routes: [
    ...apiRoutes,
    ...admin.routes,
  ],
})

console.log(`Server running on :${config.port}`)
console.log(`Admin panel at http://localhost:${config.port}/admin`)
