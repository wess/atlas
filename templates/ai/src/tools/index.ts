import type { AgentTool } from "@atlas/ai"
import { weatherTool } from "./weather.ts"
import { calculatorTool } from "./calculator.ts"
import { databaseTool } from "./database.ts"

export const tools: AgentTool[] = [
  weatherTool,
  calculatorTool,
  databaseTool,
]
