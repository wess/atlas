import { config } from "./src/config.ts"
import { cache } from "./src/cache.ts"
import { handleExample } from "./src/jobs/example.ts"

type Job = {
  id: string
  type: string
  payload: unknown
  status: string
}

const handlers: Record<string, (payload: unknown) => Promise<unknown>> = {
  example: handleExample,
}

const processJob = async (job: Job): Promise<void> => {
  console.log(`Processing job ${job.id} (${job.type})`)
  await cache.set(`jobs:status:${job.id}`, JSON.stringify({ ...job, status: "processing" }))

  try {
    const handler = handlers[job.type]
    if (!handler) throw new Error(`Unknown job type: ${job.type}`)

    const result = await handler(job.payload)
    await cache.set(`jobs:status:${job.id}`, JSON.stringify({ ...job, status: "completed", result }))
    console.log(`Job ${job.id} completed`)
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error"
    await cache.set(`jobs:status:${job.id}`, JSON.stringify({ ...job, status: "failed", error }))
    console.error(`Job ${job.id} failed: ${error}`)
  }
}

const poll = async (): Promise<void> => {
  console.log("Worker started, polling for jobs...")

  while (true) {
    const raw = await cache.rpop("jobs:queue")
    if (raw) {
      const job = JSON.parse(raw) as Job
      await processJob(job)
    } else {
      await Bun.sleep(config.pollIntervalMs)
    }
  }
}

poll()
