import { post, json } from "@wess/atlas/server"
import { runAgent } from "@wess/atlas/ai"
import { ai } from "../ai.ts"
import { authed } from "../pipes/auth.ts"
import { tools } from "../tools/index.ts"

export const agentRoutes = [
  post("/api/agent", authed(async (c) => {
    const { message } = (c.body ?? {}) as { message?: string }

    if (!message) return json(c, 400, { error: "message is required" })

    const result = await runAgent(
      {
        ai,
        tools,
        system: "You are a helpful agent with access to tools. Use them when needed to answer questions accurately.",
        maxIterations: 10,
      },
      message,
    )

    const toolCalls = result.messages
      .filter(m => m.toolCalls?.length)
      .flatMap(m => m.toolCalls ?? [])

    return json(c, 200, {
      response: result.response,
      iterations: result.iterations,
      toolCalls,
    })
  })),
]
