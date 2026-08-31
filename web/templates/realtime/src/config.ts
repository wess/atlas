import { defineConfig, env } from "@atlas/config"

export const config = defineConfig({
  port: env("PORT", { parse: Number, default: "3000" }),
  host: env("HOST", { default: "0.0.0.0" }),
})
