import type { ChatResponse, StreamChunk, ToolCall } from "../provider/index.ts";

export const parseSSE = async function* (response: Response): AsyncGenerator<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        yield data;
      }
    }
  }
};

export const collectStream = async (stream: AsyncGenerator<StreamChunk>): Promise<ChatResponse> => {
  let content = "";
  const toolCalls: ToolCall[] = [];
  for await (const chunk of stream) {
    if (chunk.type === "text" && chunk.content) content += chunk.content;
    if (chunk.type === "tool_call" && chunk.toolCall) toolCalls.push(chunk.toolCall);
  }
  return {
    content,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    model: "",
    usage: undefined,
  };
};

export const streamToSse = (stream: AsyncGenerator<StreamChunk>): ReadableStream => {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      for await (const chunk of stream) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
};
