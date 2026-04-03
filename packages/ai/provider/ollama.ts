import type {
  AiProvider,
  ChatOptions,
  ChatResponse,
  EmbedOptions,
  EmbedResponse,
  Message,
  StreamChunk,
  ToolDef,
} from "./index.ts";

type OllamaConfig = {
  baseUrl?: string;
  defaultModel?: string;
};

const formatMessages = (messages: Message[]) => messages.map((m) => ({ role: m.role, content: m.content }));

const formatTools = (tools: ToolDef[]) =>
  tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

export const createOllama = (config: OllamaConfig): AiProvider => {
  const baseUrl = (config.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
  const defaultModel = config.defaultModel ?? "llama3";

  const chat = async (opts: ChatOptions): Promise<ChatResponse> => {
    const body: Record<string, unknown> = {
      model: opts.model ?? defaultModel,
      messages: formatMessages(opts.messages),
      stream: false,
    };
    if (opts.tools?.length) body.tools = formatTools(opts.tools);
    if (opts.jsonMode) body.format = "json";

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama API error ${res.status}: ${text}`);
    }

    const data = await res.json();

    const toolCalls = data.message?.tool_calls?.map((tc: any) => ({
      id: crypto.randomUUID(),
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    return {
      content: data.message?.content ?? "",
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      usage:
        data.prompt_eval_count != null
          ? { promptTokens: data.prompt_eval_count, completionTokens: data.eval_count ?? 0 }
          : undefined,
      model: data.model ?? opts.model ?? defaultModel,
    };
  };

  const chatStream = async function* (opts: ChatOptions): AsyncGenerator<StreamChunk> {
    const body: Record<string, unknown> = {
      model: opts.model ?? defaultModel,
      messages: formatMessages(opts.messages),
      stream: true,
    };
    if (opts.jsonMode) body.format = "json";

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama API error ${res.status}: ${text}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.trim()) continue;
        const data = JSON.parse(line);
        if (data.done) {
          yield { type: "done" };
          return;
        }
        if (data.message?.content) {
          yield { type: "text", content: data.message.content };
        }
      }
    }

    yield { type: "done" };
  };

  const embed = async (opts: EmbedOptions): Promise<EmbedResponse> => {
    const inputs = Array.isArray(opts.input) ? opts.input : [opts.input];
    const embeddings: number[][] = [];

    for (const input of inputs) {
      const res = await fetch(`${baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts.model ?? defaultModel,
          prompt: input,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      embeddings.push(data.embedding);
    }

    return { embeddings };
  };

  return { name: "ollama", chat, chatStream, embed };
};
