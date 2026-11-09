---
name: atlasai
description: Add AI features with @wess/atlas/ai. Use for calling OpenAI, Anthropic, or Ollama, conversations, streaming responses over HTTP, structured JSON output, embeddings and RAG, or tool-using agents in an Atlas app.
---

# Atlas AI

One provider interface with no SDK dependency.

```ts
import { createConversation, createProvider, send } from "@wess/atlas/ai"

export const ai = createProvider({ provider: "anthropic", key: "key" })

export const ask = async (question: string) => {
  const { conversation, response } = await send(ai, createConversation("Be concise."), question)
  return { conversation, response }
}
```

`provider` is `openai`, `anthropic`, or `ollama`. `key` is required except for Ollama, where it's sent as a Bearer token for Ollama Cloud (`baseUrl: "https://ollama.com"`). `baseUrl` works on all three providers. `addMessage` returns a new conversation rather than changing the old one.

## Streaming to a browser

```ts
import { streamToSse } from "@wess/atlas/ai"
import { pipe, post, putHeader, stream } from "@wess/atlas/server"

export const chatRoute = post(
  "/api/chat",
  pipe(async (c) => {
    const { message } = (await c.request.json()) as { message: string }
    const chunks = ai.chatStream({ messages: [{ role: "user", content: message }] })
    return putHeader(stream(c, 200, streamToSse(chunks)), "content-type", "text/event-stream")
  }),
)
```

Use `collectStream(stream)` to turn a stream back into one response.

## Structured output

```ts
import { generateJson } from "@wess/atlas/ai"

export const classify = (text: string) => generateJson<{ label: string }>(ai, `Classify as JSON: ${text}`)
```

## RAG

```ts
import { createVectorStore, index, query } from "@wess/atlas/ai"

const rag = { ai, store: createVectorStore(), topK: 5 }

export const answer = async (question: string) => {
  await index(rag, "doc1", "Atlas runs on Bun.")
  return query(rag, question)
}
```

`createVectorStore` is in-memory, so re-index on start or persist the vectors yourself. For direct use: `embed(provider, input)` and `cosineSimilarity(a, b)`.

## Agents

```ts
import { runAgent, tool } from "@wess/atlas/ai"

const weather = {
  definition: tool("get_weather", "Get the weather for a city", {
    type: "object",
    properties: { city: { type: "string" } },
    required: ["city"],
  }),
  handler: async (args: Record<string, unknown>) => `Sunny in ${String(args.city)}`,
}

export const run = (prompt: string) =>
  runAgent({ ai, tools: [weather], system: "Use tools when needed.", maxIterations: 10 }, prompt)
```

A handler that throws, an unknown tool name, or arguments that aren't valid JSON (`call.error`) come back to the model as an `Error: ...` tool result instead of ending the run. Pass `approve: (call) => boolean | Promise<boolean>` to refuse calls before they run, for example anything that writes.

Tool arguments come from the model, and a prompt-injected document or user message can choose them. Treat them like request input from a stranger:

```ts
import type { AgentTool } from "@wess/atlas/ai"
import { tool } from "@wess/atlas/ai"

const schema = { type: "object", properties: { a: { type: "number" }, b: { type: "number" } } }

// Never: this runs whatever the model (or the page it just read) wrote, as code on your server.
export const unsafe: AgentTool = {
  definition: tool("calculate", "Evaluate math", { type: "object", properties: { expression: { type: "string" } } }),
  handler: async (args) => String(new Function(`return ${args.expression}`)()),
}

// Instead: parse into the narrow shape the tool needs and reject everything else.
export const multiply: AgentTool = {
  definition: tool("multiply", "Multiply two numbers", schema),
  handler: async (args) => {
    const a = Number(args.a)
    const b = Number(args.b)
    return Number.isFinite(a) && Number.isFinite(b) ? String(a * b) : "Error: a and b must be numbers"
  },
}
```

The same goes for SQL, shell commands, file paths, and URLs: no `eval`, no string-built queries, and no write access without its own check.

## UI

`ChatWindow`, `MessageBubble`, `PromptInput`, `AiSearch`, and `GenerateButton` come from `@wess/atlas/ui/ai`. `withAi(provider)` from this module puts the provider on `conn.assigns.ai`. The `ai` template wires all of this together.
