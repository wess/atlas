import { defineConfig, env } from "@wess/atlas/config"
import { serve, get, post, pipe, json } from "@wess/atlas/server"

const config = defineConfig({
  port: env("PORT", { parse: Number, default: "3000" }),
})

serve({
  port: config.port,
  routes: [
    get("/", pipe((c) => json(c, 200, { status: "ok" }))),
    get("/health", pipe((c) => json(c, 200, { healthy: true }))),
  ],
})

console.log(`Server running on :${config.port}`)
