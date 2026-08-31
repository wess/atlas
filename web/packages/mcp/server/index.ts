import type { AtlasMcpContext } from "../context/index.ts";
import type { Tool } from "../tools/index.ts";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type McpServer = {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly handleRequest: (req: JsonRpcRequest) => Promise<JsonRpcResponse>;
};

export const createMcpServer = (tools: Tool[], ctx: AtlasMcpContext): McpServer => {
  let running = true;

  const handleRequest = async (req: JsonRpcRequest): Promise<JsonRpcResponse> => {
    const id = req.id ?? 0;

    if (req.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "atlas-mcp", version: "0.0.1" },
          capabilities: { tools: {} },
        },
      };
    }

    if (req.method === "notifications/initialized") {
      return { jsonrpc: "2.0", id, result: {} };
    }

    if (req.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      };
    }

    if (req.method === "tools/call") {
      const p = req.params as { name: string; arguments?: Record<string, unknown> };
      const tool = tools.find((t) => t.name === p.name);
      if (!tool) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${p.name}` },
        };
      }
      try {
        const result = await tool.handler(p.arguments ?? {}, ctx);
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
        };
      } catch (e) {
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true },
        };
      }
    }

    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${req.method}` },
    };
  };

  return {
    handleRequest,
    start: async () => {
      const stdin = Bun.stdin.stream();
      const reader = stdin.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (running) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);

        while (buffer.includes("\r\n\r\n")) {
          const headerEnd = buffer.indexOf("\r\n\r\n");
          const header = buffer.slice(0, headerEnd);
          const match = header.match(/Content-Length: (\d+)/);
          if (!match) {
            buffer = buffer.slice(headerEnd + 4);
            continue;
          }

          const contentLength = parseInt(match[1]!, 10);
          const bodyStart = headerEnd + 4;
          if (buffer.length < bodyStart + contentLength) break;

          const body = buffer.slice(bodyStart, bodyStart + contentLength);
          buffer = buffer.slice(bodyStart + contentLength);

          const req = JSON.parse(body) as JsonRpcRequest;
          const res = await handleRequest(req);

          if (req.id !== undefined) {
            const resBody = JSON.stringify(res);
            const resMsg = `Content-Length: ${Buffer.byteLength(resBody)}\r\n\r\n${resBody}`;
            process.stdout.write(resMsg);
          }
        }
      }
      reader.releaseLock();
    },
    stop: () => {
      running = false;
    },
  };
};
