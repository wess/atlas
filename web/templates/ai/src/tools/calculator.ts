import { tool } from "@atlas/ai"
import type { AgentTool } from "@atlas/ai"

export const calculatorTool: AgentTool = {
  definition: tool("calculate", "Evaluate a math expression", {
    type: "object",
    properties: { expression: { type: "string", description: "Math expression to evaluate" } },
    required: ["expression"],
  }),
  handler: async (args: Record<string, unknown>) => {
    try {
      const result = new Function(`return ${args.expression}`)()
      return String(result)
    } catch {
      return "Error: invalid expression"
    }
  },
}
