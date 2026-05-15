import { parseSSE } from "../stream/index.ts";
import type {
  AiProvider,
  ChatOptions,
  ChatResponse,
  EmbedOptions,
  EmbedResponse,
  Message,
  StreamChunk,
  ToolCall,
  ToolDef,
} from "./index.ts";

type OpenAiConfig = {
  key: string;
  baseUrl?: string;
  defaultModel?: string;
};

const formatTools = (tools: ToolDef[]) =>
  tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

const formatMessages = (messages: Message[]) =>
  messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool" as const, content: m.content, tool_call_id: m.toolCallId };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant" as const,
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });

const parseToolCalls = (choices: any[]): ToolCall[] | undefined => {
  const calls = choices[0]?.message?.tool_calls;
  if (!calls?.length) return undefined;
  return calls.map((tc: any) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments),
  }));
};

export const createOpenAi = (config: OpenAiConfig): AiProvider => {
  const baseUrl = (config.baseUrl ?? "https://api.openai.com").replace(/\/$/, "");
  const defaultModel = config.defaultModel ?? "gpt-4o";

  const headers = {
    Authorization: `Bearer ${config.key}`,
    "Content-Type": "application/json",
  };

  const chat = async (opts: ChatOptions): Promise<ChatResponse> => {
    const body: Record<string, unknown> = {
      model: opts.model ?? defaultModel,
      messages: formatMessages(opts.messages),
    };
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
    if (opts.tools?.length) body.tools = formatTools(opts.tools);
    if (opts.jsonMode) body.response_format = { type: "json_object" };

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `OpenAI chat request failed (HTTP ${res.status}): ${text}. Verify OPENAI_API_KEY is set and valid.`,
      );
    }

    const data = await res.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content ?? "",
      toolCalls: parseToolCalls(data.choices),
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
        : undefined,
      model: data.model,
    };
  };

  const chatStream = async function* (opts: ChatOptions): AsyncGenerator<StreamChunk> {
    const body: Record<string, unknown> = {
      model: opts.model ?? defaultModel,
      messages: formatMessages(opts.messages),
      stream: true,
    };
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
    if (opts.tools?.length) body.tools = formatTools(opts.tools);

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `OpenAI stream request failed (HTTP ${res.status}): ${text}. Verify OPENAI_API_KEY is set and valid.`,
      );
    }

    const toolCallAccumulator: Map<number, { id: string; name: string; args: string }> = new Map();

    for await (const data of parseSSE(res)) {
      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta;

      if (delta?.content) {
        yield { type: "text", content: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCallAccumulator.has(idx)) {
            toolCallAccumulator.set(idx, { id: tc.id ?? "", name: tc.function?.name ?? "", args: "" });
          }
          const acc = toolCallAccumulator.get(idx)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) acc.args += tc.function.arguments;
        }
      }

      if (parsed.choices?.[0]?.finish_reason === "tool_calls") {
        for (const [, acc] of toolCallAccumulator) {
          yield {
            type: "tool_call",
            toolCall: { id: acc.id, name: acc.name, arguments: JSON.parse(acc.args) },
          };
        }
      }
    }

    yield { type: "done" };
  };

  const embed = async (opts: EmbedOptions): Promise<EmbedResponse> => {
    const res = await fetch(`${baseUrl}/v1/embeddings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: opts.model ?? "text-embedding-3-small",
        input: opts.input,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `OpenAI embeddings request failed (HTTP ${res.status}): ${text}. Verify OPENAI_API_KEY is set and valid.`,
      );
    }

    const data = await res.json();
    return { embeddings: data.data.map((d: any) => d.embedding) };
  };

  return { name: "openai", chat, chatStream, embed };
};
