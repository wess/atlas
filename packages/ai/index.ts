// provider
export { createProvider } from "./provider/index.ts";
export type {
  AiProvider,
  ProviderConfig,
  Message,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  EmbedOptions,
  EmbedResponse,
  ToolDef,
  ToolCall,
} from "./provider/index.ts";

// chat
export {
  createConversation,
  addMessage,
  send,
  userMessage,
  assistantMessage,
  systemMessage,
  toolMessage,
} from "./chat/index.ts";
export type { Conversation } from "./chat/index.ts";

// stream
export { parseSSE, collectStream, streamToSse } from "./stream/index.ts";

// embeddings
export { embed, cosineSimilarity, createVectorStore } from "./embeddings/index.ts";
export type { VectorStore, VectorEntry } from "./embeddings/index.ts";

// structured
export { generateJson, tool } from "./structured/index.ts";

// rag
export { index, query } from "./rag/index.ts";
export type { RagOptions } from "./rag/index.ts";

// agents
export { runAgent } from "./agents/index.ts";
export type { AgentTool, AgentOptions } from "./agents/index.ts";

// pipes
export { withAi } from "./pipes/index.ts";
