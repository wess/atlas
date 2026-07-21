import { get, pipe, putHeader, serve, text } from "@atlas/server"
import { config } from "./src/config.ts"
import { agentRoutes } from "./src/routes/agent.ts"
import { chatRoutes } from "./src/routes/chat.ts"
import { documentRoutes } from "./src/routes/documents.ts"
import { healthRoutes } from "./src/routes/health.ts"
import { ragRoutes } from "./src/routes/rag.ts"
import { searchRoutes } from "./src/routes/search.ts"

const page = await Bun.file(new URL("./index.html", import.meta.url)).text()

serve({
  port: config.port,
  routes: [
    get("/", pipe((c) => putHeader(text(c, 200, page), "content-type", "text/html; charset=utf-8"))),
    ...healthRoutes,
    ...chatRoutes,
    ...documentRoutes,
    ...searchRoutes,
    ...ragRoutes,
    ...agentRoutes,
  ],
})

console.log(`Server running on :${config.port}`)
