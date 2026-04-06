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

type AnthropicConfig = {
  key: string;
  defaultModel?: string;
};

const formatTools = (tools: ToolDef[]) =>
  tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

const formatMessages = (messages: Message[]) => {
  const formatted: any[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      formatted.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.toolCallId,
            content: m.content,
          },
        ],
      });
      continue;
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      const content: any[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls) {
        content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      }
      formatted.push({ role: "assistant", content });
      continue;
    }
    formatted.push({ role: m.role, content: m.content });
  }
  return formatted;
};

const extractSystem = (messages: Message[]): string | undefined => {
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content);
  return sys.length > 0 ? sys.join("\n\n") : undefined;
};

export const createAnthropic = (config: AnthropicConfig): AiProvider => {
  const baseUrl = "https://api.anthropic.com";
  const defaultModel = config.defaultModel ?? "claude-sonnet-4-20250514";

  const headers = {
    "x-api-key": config.key,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };

  const chat = async (opts: ChatOptions): Promise<ChatResponse> => {
    const system = extractSystem(opts.messages);
    const body: Record<string, unknown> = {
      model: opts.model ?? defaultModel,
      messages: formatMessages(opts.messages),
      max_tokens: opts.maxTokens ?? 4096,
    };
    if (system) body.system = system;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.tools?.length) body.tools = formatTools(opts.tools);

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Anthropic chat request failed (HTTP ${res.status}): ${text}. Verify ANTHROPIC_API_KEY is set and valid.`,
      );
    }

    const data = await res.json();

    const textBlocks = data.content.filter((b: any) => b.type === "text");
    const toolBlocks = data.content.filter((b: any) => b.type === "tool_use");

    const toolCalls: ToolCall[] | undefined =
      toolBlocks.length > 0 ? toolBlocks.map((b: any) => ({ id: b.id, name: b.name, arguments: b.input })) : undefined;

    return {
      content: textBlocks.map((b: any) => b.text).join(""),
      toolCalls,
      usage: data.usage
        ? { promptTokens: data.usage.input_tokens, completionTokens: data.usage.output_tokens }
        : undefined,
      model: data.model,
    };
  };

  const chatStream = async function* (opts: ChatOptions): AsyncGenerator<StreamChunk> {
    const system = extractSystem(opts.messages);
    const body: Record<string, unknown> = {
      model: opts.model ?? defaultModel,
      messages: formatMessages(opts.messages),
      max_tokens: opts.maxTokens ?? 4096,
      stream: true,
    };
    if (system) body.system = system;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.tools?.length) body.tools = formatTools(opts.tools);

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Anthropic stream request failed (HTTP ${res.status}): ${text}. Verify ANTHROPIC_API_KEY is set and valid.`,
      );
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentToolId = "";
    let currentToolName = "";
    let currentToolArgs = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") {
          yield { type: "done" };
          return;
        }

        const event = JSON.parse(data);

        if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
          currentToolId = event.content_block.id;
          currentToolName = event.content_block.name;
          currentToolArgs = "";
        }

        if (event.type === "content_block_delta") {
          if (event.delta?.type === "text_delta") {
            yield { type: "text", content: event.delta.text };
          }
          if (event.delta?.type === "input_json_delta") {
            currentToolArgs += event.delta.partial_json;
          }
        }

        if (event.type === "content_block_stop" && currentToolId) {
          yield {
            type: "tool_call",
            toolCall: {
              id: currentToolId,
              name: currentToolName,
              arguments: currentToolArgs ? JSON.parse(currentToolArgs) : {},
            },
          };
          currentToolId = "";
          currentToolName = "";
          currentToolArgs = "";
        }

        if (event.type === "message_stop") {
          yield { type: "done" };
          return;
        }
      }
    }

    yield { type: "done" };
  };

  const embed = async (_opts: EmbedOptions): Promise<EmbedResponse> => {
    throw new Error(
      "Anthropic does not support embeddings. Use OpenAI or Ollama for the embed() function. Example: createProvider({ provider: 'openai', key: '...' })",
    );
  };

  return { name: "anthropic", chat, chatStream, embed };
};
