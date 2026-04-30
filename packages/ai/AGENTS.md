# @atlas/ai

Unified AI provider abstraction with chat, embeddings, streaming, RAG, and agent support. Zero external dependencies -- uses fetch for all API calls.

## Exports

Provider:
- `createProvider({ provider, key?, baseUrl? })` → `AiProvider` — provider is `"openai" | "anthropic" | "ollama"`
- `AiProvider` exposes `.chat(opts)`, `.chatStream(opts)`, `.embed(opts)`

Chat:
- `createConversation(system?)` → `Conversation`
- `addMessage(conv, msg)` → `Conversation` (immutable)
- `send(provider, conv, content, opts?)` → `{ conversation, response }`
- `userMessage`, `assistantMessage`, `systemMessage`, `toolMessage`

Stream:
- `parseSSE(text)` → events
- `collectStream(stream)` → `ChatResponse`
- `streamToSse(stream)` → `ReadableStream` (for HTTP responses)

Embeddings:
- `embed(provider, inputs, opts?)` → `number[][]`
- `cosineSimilarity(a, b)` → `number`
- `createVectorStore()` → `{ add, search, size }`

Structured / tools:
- `generateJson<T>(provider, prompt, opts?)` → `T`
- `tool(name, description, schema)` → `ToolDefinition`

RAG:
- `index(rag, id, text)` → `Promise<void>` — `rag = { ai, store, topK? }`
- `query(rag, question)` → `{ answer, sources }`

Agents:
- `runAgent({ ai, system?, tools, maxIterations? }, prompt)` → result

Server pipe:
- `withAi(provider)` → `PipeFn` — adds `provider` to `conn.assigns.ai`

## Types

- `ProviderConfig`, `Message`, `ChatOptions`, `ChatResponse`, `StreamChunk`
- `EmbedOptions`, `EmbedResponse`, `ToolDef`, `ToolCall`
- `Conversation`, `VectorStore`, `VectorEntry`, `RagOptions`
- `AgentTool`, `AgentOptions`

## Provider setup

```ts
import { createProvider } from "@atlas/ai"

const openai = createProvider({ provider: "openai", key: process.env.OPENAI_API_KEY! })
const anthropic = createProvider({ provider: "anthropic", key: process.env.ANTHROPIC_API_KEY! })
const ollama = createProvider({ provider: "ollama" }) // local, no key needed
```

## Chat

```ts
import { createConversation, send } from "@atlas/ai"

const conv = createConversation("You are a helpful assistant")
const { conversation, response } = await send(openai, conv, "Hello!")
// conversation tracks full message history immutably
```

## Streaming

```ts
import { collectStream, streamToSse } from "@atlas/ai"

const stream = openai.chatStream({ messages: [{ role: "user", content: "Hi" }] })
const full = await collectStream(stream) // collect into ChatResponse
const sse = streamToSse(stream) // convert to ReadableStream for HTTP responses
```

## Embeddings and vector search

```ts
import { embed, cosineSimilarity, createVectorStore } from "@atlas/ai"

const vectors = await embed(openai, ["hello", "world"])
const score = cosineSimilarity(vectors[0]!, vectors[1]!)

const store = createVectorStore()
store.add("id1", vectors[0]!, { text: "hello" })
const results = store.search(vectors[1]!, 5) // top 5 nearest
```

## Structured output

```ts
import { generateJson, tool } from "@atlas/ai"

const user = await generateJson<{ name: string }>(openai, "Generate a user")
const searchTool = tool("search", "Search the web", { type: "object", properties: { query: { type: "string" } } })
```

## RAG

```ts
import { index, query, createVectorStore, createProvider } from "@atlas/ai"

const store = createVectorStore()
const rag = { ai: openai, store, topK: 3 }

await index(rag, "doc1", "Document text here...")
const result = await query(rag, "What does the document say?")
// result.answer, result.sources
```

## Agent loop

```ts
import { runAgent, tool } from "@atlas/ai"

const result = await runAgent({
  ai: openai,
  system: "You are a calculator assistant",
  tools: [{
    definition: tool("multiply", "Multiply two numbers", {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
    }),
    handler: async (args) => String((args.a as number) * (args.b as number)),
  }],
  maxIterations: 5,
}, "What is 6 times 7?")
```

## Server pipe

```ts
import { withAi } from "@atlas/ai"

// Add AI provider to conn.assigns.ai in a server pipeline
const aiPipe = withAi(openai)
```

## Architecture

- `provider/` -- Provider interface and adapters (openai, anthropic, ollama)
- `chat/` -- Immutable conversation management
- `stream/` -- SSE parsing, stream collection, SSE response generation
- `embeddings/` -- Vector embeddings and in-memory vector store
- `structured/` -- JSON mode and tool definitions
- `rag/` -- Retrieval-augmented generation pipeline
- `agents/` -- Tool-use agent loop with iteration limits
- `pipes/` -- Server middleware integration

## Dependencies

- `@atlas/server` — only for the `withAi` pipe; the rest of the package stands alone.
- External: none. All provider calls go through `fetch`.

## Testing

All tests use mock providers. No real API calls.

```sh
bun test packages/ai/
```
