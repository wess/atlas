import { post, pipe, json } from "@atlas/server"
import { runAgent } from "@atlas/ai"
import { ai } from "../ai.ts"
import { tools } from "../tools/index.ts"

export const agentRoutes = [
  post("/api/agent", pipe(async (c) => {
    const body = await c.request.json()
    const { message } = body as { message: string }

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
