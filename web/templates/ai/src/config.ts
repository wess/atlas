import { defineConfig, env } from "@atlas/config"

export const config = defineConfig({
  port: env("PORT", { parse: Number, default: "3000" }),
  databaseUrl: env("DATABASE_URL", { default: "sqlite://app.db" }),
  auth: {
    secret: env("AUTH_SECRET", { default: "dev-secret" }),
  },
  ai: {
    provider: env("AI_PROVIDER", { default: "openai" }),
    openaiKey: env("OPENAI_API_KEY", { default: "" }),
    anthropicKey: env("ANTHROPIC_API_KEY", { default: "" }),
    ollamaUrl: env("OLLAMA_BASE_URL", { default: "http://localhost:11434" }),
  },
})
