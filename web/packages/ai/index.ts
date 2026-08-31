// provider

export type { AgentOptions, AgentTool } from "./agents/index.ts";
// agents
export { runAgent } from "./agents/index.ts";
export type { Conversation } from "./chat/index.ts";
// chat
export {
  addMessage,
  assistantMessage,
  createConversation,
  send,
  systemMessage,
  toolMessage,
  userMessage,
} from "./chat/index.ts";
export type { VectorEntry, VectorStore } from "./embeddings/index.ts";

// embeddings
export { cosineSimilarity, createVectorStore, embed } from "./embeddings/index.ts";
// pipes
export { withAi } from "./pipes/index.ts";
export type {
  AiProvider,
  ChatOptions,
  ChatResponse,
  EmbedOptions,
  EmbedResponse,
  Message,
  ProviderConfig,
  StreamChunk,
  ToolCall,
  ToolDef,
} from "./provider/index.ts";
export { createProvider } from "./provider/index.ts";
export type { RagOptions } from "./rag/index.ts";
// rag
export { index, query } from "./rag/index.ts";
// stream
export { collectStream, parseSSE, streamToSse } from "./stream/index.ts";
// structured
export { generateJson, tool } from "./structured/index.ts";
