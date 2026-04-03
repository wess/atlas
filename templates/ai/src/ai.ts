import { createProvider } from "@atlas/ai"
import { config } from "./config.ts"

const providerConfig = () => {
  switch (config.ai.provider) {
    case "anthropic": return { provider: "anthropic" as const, key: config.ai.anthropicKey }
    case "ollama": return { provider: "ollama" as const, baseUrl: config.ai.ollamaUrl }
    default: return { provider: "openai" as const, key: config.ai.openaiKey }
  }
}

export const ai = createProvider(providerConfig())
