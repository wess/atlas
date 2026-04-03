import { serve } from "@atlas/server"
import { config } from "./src/config.ts"
import { healthRoutes } from "./src/routes/health.ts"
import { chatRoutes } from "./src/routes/chat.ts"
import { documentRoutes } from "./src/routes/documents.ts"
import { searchRoutes } from "./src/routes/search.ts"
import { ragRoutes } from "./src/routes/rag.ts"
import { agentRoutes } from "./src/routes/agent.ts"

serve({
  port: config.port,
  routes: [
    ...healthRoutes,
    ...chatRoutes,
    ...documentRoutes,
    ...searchRoutes,
    ...ragRoutes,
    ...agentRoutes,
  ],
})

console.log(`Server running on :${config.port}`)
