import { createAnthropic } from "./anthropic.ts";
import { createOllama } from "./ollama.ts";
import { createOpenAi } from "./openai.ts";

export type Message = {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  readonly name?: string;
  readonly toolCallId?: string;
  readonly toolCalls?: ToolCall[];
};

export type ToolCall = {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
};

export type ChatOptions = {
  readonly messages: Message[];
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly tools?: ToolDef[];
  readonly jsonMode?: boolean;
  readonly stream?: boolean;
};

export type ChatResponse = {
  readonly content: string;
  readonly toolCalls?: ToolCall[];
  readonly usage?: { promptTokens: number; completionTokens: number };
  readonly model: string;
};

export type StreamChunk = {
  readonly type: "text" | "tool_call" | "done";
  readonly content?: string;
  readonly toolCall?: ToolCall;
};

export type EmbedOptions = {
  readonly input: string | string[];
  readonly model?: string;
};

export type EmbedResponse = {
  readonly embeddings: number[][];
};

export type ToolDef = {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
};

export type AiProvider = {
  readonly name: string;
  readonly chat: (opts: ChatOptions) => Promise<ChatResponse>;
  readonly chatStream: (opts: ChatOptions) => AsyncGenerator<StreamChunk>;
  readonly embed: (opts: EmbedOptions) => Promise<EmbedResponse>;
};

export type ProviderConfig =
  | { provider: "openai"; key: string; baseUrl?: string; defaultModel?: string }
  | { provider: "anthropic"; key: string; defaultModel?: string }
  | { provider: "ollama"; baseUrl?: string; defaultModel?: string };

export const createProvider = (config: ProviderConfig): AiProvider => {
  switch (config.provider) {
    case "openai":
      return createOpenAi(config);
    case "anthropic":
      return createAnthropic(config);
    case "ollama":
      return createOllama(config);
    default:
      throw new Error(
        `Unknown provider: '${(config as any).provider}'. Supported providers are 'openai', 'anthropic', and 'ollama'. Example: createProvider({ provider: 'openai', key: env('OPENAI_API_KEY') })`,
      );
  }
};
