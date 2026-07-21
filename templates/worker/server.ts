import { get, json, parseJson, pipe, pipeline, post, serve } from "@atlas/server"
import { cache } from "./src/cache.ts"
import { config } from "./src/config.ts"
import { enqueue } from "./src/queue.ts"

const parsed = pipeline(parseJson)

serve({
  port: config.port,
  routes: [
    get("/health", pipe((c) => json(c, 200, { healthy: true }))),

    post("/api/jobs", parsed(async (c) => {
      const { type, payload } = c.body as { type: string; payload?: unknown }
      if (!type) return json(c, 400, { error: "type is required" })

      const job = { id: crypto.randomUUID(), type, payload }
      await cache.set(`jobs:status:${job.id}`, { ...job, status: "pending" })
      await enqueue(job)

      return json(c, 201, { id: job.id, status: "pending" })
    })),

    get("/api/jobs/:id/status", pipe(async (c) => {
      const status = await cache.get(`jobs:status:${c.params.id}`)
      return status ? json(c, 200, status) : json(c, 404, { error: "Job not found" })
    })),
  ],
})

console.log(`Server running on :${config.port}`)
