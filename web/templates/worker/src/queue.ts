import { config } from "./config.ts"

export type Job = {
  readonly id: string
  readonly type: string
  readonly payload?: unknown
}

const redis = new Bun.RedisClient(config.redisUrl)
const key = "jobs:queue"

export const enqueue = async (job: Job): Promise<void> => {
  await redis.lpush(key, JSON.stringify(job))
}

export const dequeue = async (): Promise<Job | null> => {
  const raw = await redis.rpop(key)
  return raw ? (JSON.parse(raw) as Job) : null
}
