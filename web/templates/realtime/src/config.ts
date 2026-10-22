import { defineConfig, env } from "@wess/atlas/config"

export const config = defineConfig({
  port: env("PORT", { parse: Number, default: "3000" }),
  host: env("HOST", { default: "0.0.0.0" }),
})
