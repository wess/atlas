import { defineConfig, env } from "@atlas/config"

export const config = defineConfig({
  port: env("PORT", { parse: Number, default: "3000" }),
  host: env("HOST", { default: "0.0.0.0" }),
  redisUrl: env("REDIS_URL", { default: "redis://localhost:6379" }),
  pollIntervalMs: env("POLL_INTERVAL_MS", { parse: Number, default: "1000" }),
})
