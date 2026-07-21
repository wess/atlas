import { cache } from "./src/cache.ts"
import { config } from "./src/config.ts"
import { handleExample } from "./src/jobs/example.ts"
import { dequeue, type Job } from "./src/queue.ts"

const handlers: Record<string, (payload: unknown) => Promise<unknown>> = {
  example: handleExample,
}

const processJob = async (job: Job): Promise<void> => {
  console.log(`Processing job ${job.id} (${job.type})`)
  await cache.set(`jobs:status:${job.id}`, { ...job, status: "processing" })

  try {
    const handler = handlers[job.type]
    if (!handler) throw new Error(`Unknown job type: ${job.type}`)

    const result = await handler(job.payload)
    await cache.set(`jobs:status:${job.id}`, { ...job, status: "completed", result })
    console.log(`Job ${job.id} completed`)
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error"
    await cache.set(`jobs:status:${job.id}`, { ...job, status: "failed", error })
    console.error(`Job ${job.id} failed: ${error}`)
  }
}

console.log("Worker started, polling for jobs...")

while (true) {
  const job = await dequeue()
  if (job) {
    await processJob(job)
  } else {
    await Bun.sleep(config.pollIntervalMs)
  }
}
