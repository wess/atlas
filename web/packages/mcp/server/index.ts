import type { AtlasMcpContext } from "../context/index.ts";
import type { Tool } from "../tools/index.ts";
import { createFramer } from "./framing.ts";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
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
  let input: ReadableStreamDefaultReader<Uint8Array> | undefined;

  const handleRequest = async (req: JsonRpcRequest): Promise<JsonRpcResponse> => {
    if (
      !req ||
      typeof req !== "object" ||
      req.jsonrpc !== "2.0" ||
      typeof req.method !== "string" ||
      (req.id !== undefined && typeof req.id !== "string" && typeof req.id !== "number")
    ) {
      return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } };
    }
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
      if (
        !p ||
        typeof p !== "object" ||
        typeof p.name !== "string" ||
        (p.arguments !== undefined && (!p.arguments || typeof p.arguments !== "object" || Array.isArray(p.arguments)))
      ) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid tool parameters" } };
      }
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
      const reader = Bun.stdin.stream().getReader();
      input = reader;
      const frames = createFramer();
      try {
        while (running) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const body of frames.push(value)) {
            let req: JsonRpcRequest;
            try {
              req = JSON.parse(body) as JsonRpcRequest;
            } catch {
              const response = JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32700, message: "Parse error" },
              });
              await Bun.write(Bun.stdout, `Content-Length: ${Buffer.byteLength(response)}\r\n\r\n${response}`);
              continue;
            }
            const res = await handleRequest(req);
            if (!req || req.id !== undefined || res.error?.code === -32600) {
              const response = JSON.stringify(res);
              await Bun.write(Bun.stdout, `Content-Length: ${Buffer.byteLength(response)}\r\n\r\n${response}`);
            }
            if (!running) break;
          }
        }
      } finally {
        input = undefined;
        await reader.cancel();
        reader.releaseLock();
      }
    },
    stop: () => {
      running = false;
      void input?.cancel();
    },
  };
};
