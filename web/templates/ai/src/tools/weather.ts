import { tool } from "@atlas/ai"
import type { AgentTool } from "@atlas/ai"

export const weatherTool: AgentTool = {
  definition: tool("get_weather", "Get current weather for a city", {
    type: "object",
    properties: { city: { type: "string", description: "City name" } },
    required: ["city"],
  }),
  handler: async (args: Record<string, unknown>) => {
    const city = args.city as string
    const conditions = ["sunny", "cloudy", "rainy", "partly cloudy", "windy"]
    const temp = 55 + Math.floor(Math.random() * 35)
    const condition = conditions[Math.floor(Math.random() * conditions.length)]
    return JSON.stringify({ city, temperature: temp, condition, unit: "fahrenheit" })
  },
}
