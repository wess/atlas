import { migrate } from "@wess/atlas/migrate"
import { get, pipe, putHeader, serve, text } from "@wess/atlas/server"
import { config } from "./src/config.ts"
import { db } from "./src/db.ts"
import { agentRoutes } from "./src/routes/agent.ts"
import { authRoutes } from "./src/routes/auth.ts"
import { chatRoutes } from "./src/routes/chat.ts"
import { documentRoutes } from "./src/routes/documents.ts"
import { healthRoutes } from "./src/routes/health.ts"
import { ragRoutes } from "./src/routes/rag.ts"
import { searchRoutes } from "./src/routes/search.ts"

// the users table and conversation owners come from migrations, so apply them before serving
await migrate.up(db, "./migrations")

const page = await Bun.file(new URL("./index.html", import.meta.url)).text()

const shell = pipe((c) => putHeader(text(c, 200, page), "content-type", "text/html; charset=utf-8"))

serve({
  port: config.port,
  routes: [
    get("/", shell),
    get("/app/*", shell),
    ...healthRoutes,
    ...authRoutes,
    ...chatRoutes,
    ...documentRoutes,
    ...searchRoutes,
    ...ragRoutes,
    ...agentRoutes,
  ],
})

console.log(`Server running on :${config.port}`)
