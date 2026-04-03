import { config } from "./src/config.ts"
import { serve, get, post, pipe, json } from "@atlas/server"
import { cache } from "./src/cache.ts"

serve({
  port: config.port,
  routes: [
    get("/health", pipe((c) => json(c, 200, { healthy: true }))),

    post("/api/jobs", pipe(
      async (c) => {
        const body = await c.req.json()
        const jobId = crypto.randomUUID()
        const job = { id: jobId, type: body.type, payload: body.payload, status: "pending" }
        await cache.lpush("jobs:queue", JSON.stringify(job))
        return json(c, 201, { id: jobId, status: "pending" })
      },
    )),

    get("/api/jobs/:id/status", pipe(
      async (c) => {
        const status = await cache.get(`jobs:status:${c.params.id}`)
        return status
          ? json(c, 200, JSON.parse(status))
          : json(c, 404, { error: "Job not found" })
      },
    )),
  ],
})

console.log(`Server running on :${config.port}`)
