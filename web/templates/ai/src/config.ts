import { defineConfig, env } from "@wess/atlas/config"

export const config = defineConfig({
  port: env("PORT", { parse: Number, default: "3000" }),
  databaseUrl: env("DATABASE_URL", { default: "sqlite://app.db" }),
  auth: {
    secret: env("AUTH_SECRET", { parse: (value) => {
    if (value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 random characters");
    return value;
  } }),
  },
  ai: {
    provider: env("AI_PROVIDER", { default: "openai" }),
    openaiKey: env("OPENAI_API_KEY", { default: "" }),
    anthropicKey: env("ANTHROPIC_API_KEY", { default: "" }),
    ollamaUrl: env("OLLAMA_BASE_URL", { default: "http://localhost:11434" }),
  },
})
