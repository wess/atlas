import { test, expect } from "bun:test";
import { createMcpServer } from "../server/index.ts";
import { defineTool } from "../tools/index.ts";
import { createContext } from "../context/index.ts";

test("createMcpServer creates a server", () => {
  const server = createMcpServer([], createContext());
  expect(typeof server.start).toBe("function");
  expect(typeof server.stop).toBe("function");
});

test("initialize returns server info", async () => {
  const server = createMcpServer([], createContext());
  const res = await server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
  });
  expect(res.result).toEqual({
    protocolVersion: "2024-11-05",
    serverInfo: { name: "atlas-mcp", version: "0.0.1" },
    capabilities: { tools: {} },
  });
});

test("tools/list returns registered tools", async () => {
  const tool = defineTool({
    name: "test.echo",
    description: "Echo input",
    inputSchema: { type: "object", properties: { msg: { type: "string" } } },
    handler: async (params) => ({ echo: params.msg }),
  });
  const server = createMcpServer([tool], createContext());
  const res = await server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  const result = res.result as any;
  expect(result.tools).toHaveLength(1);
  expect(result.tools[0].name).toBe("test.echo");
});

test("tools/call invokes a tool", async () => {
  const tool = defineTool({
    name: "test.echo",
    description: "Echo input",
    inputSchema: { type: "object", properties: { msg: { type: "string" } } },
    handler: async (params) => ({ echo: params.msg }),
  });
  const server = createMcpServer([tool], createContext());
  const res = await server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "test.echo", arguments: { msg: "hello" } },
  });
  const result = res.result as any;
  expect(result.content[0].type).toBe("text");
  const parsed = JSON.parse(result.content[0].text);
  expect(parsed.echo).toBe("hello");
});

test("tools/call returns error for unknown tool", async () => {
  const server = createMcpServer([], createContext());
  const res = await server.handleRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "nonexistent" },
  });
  expect(res.error).toBeDefined();
  expect(res.error!.code).toBe(-32601);
});

test("tools/call handles tool errors gracefully", async () => {
  const tool = defineTool({
    name: "test.fail",
    description: "Always fails",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      throw new Error("boom");
    },
  });
  const server = createMcpServer([tool], createContext());
  const res = await server.handleRequest({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "test.fail", arguments: {} },
  });
  const result = res.result as any;
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain("boom");
});

test("unknown method returns error", async () => {
  const server = createMcpServer([], createContext());
  const res = await server.handleRequest({
    jsonrpc: "2.0",
    id: 6,
    method: "unknown/method",
  });
  expect(res.error).toBeDefined();
  expect(res.error!.code).toBe(-32601);
});
