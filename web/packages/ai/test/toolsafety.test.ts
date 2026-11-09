import { afterEach, expect, test } from "bun:test";
import { runAgent } from "../agents/index.ts";
import { parseToolArguments } from "../provider/arguments.ts";
import type { AiProvider, Message, StreamChunk, ToolCall } from "../provider/index.ts";
import { createProvider } from "../provider/index.ts";
import { tool } from "../structured/index.ts";

const real = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = real;
});

// A provider that asks for `calls` once, then answers with whatever the tool results were.
const scripted = (calls: ToolCall[]): AiProvider => {
  let turn = 0;
  return {
    name: "mock",
    chat: async (opts) => {
      turn++;
      if (turn === 1) return { content: "", model: "mock", toolCalls: calls };
      const results = opts.messages.filter((m: Message) => m.role === "tool").map((m) => m.content);
      return { content: results.join(" | "), model: "mock" };
    },
    chatStream: async function* () {},
    embed: async () => ({ embeddings: [] }),
  };
};

const toolResults = (messages: Message[]) => messages.filter((m) => m.role === "tool").map((m) => m.content);

test("a throwing tool handler becomes the tool result instead of aborting the run", async () => {
  const result = await runAgent(
    {
      ai: scripted([{ id: "1", name: "boom", arguments: {} }]),
      tools: [
        {
          definition: tool("boom", "Fails", {}),
          handler: async () => {
            throw new Error("database is locked");
          },
        },
      ],
    },
    "go",
  );
  expect(result.iterations).toBe(2);
  expect(toolResults(result.messages)).toEqual(["Error: database is locked"]);
  expect(result.response).not.toContain("at ");
});

test("a non-Error throw is reported as text", async () => {
  const result = await runAgent(
    {
      ai: scripted([{ id: "1", name: "boom", arguments: {} }]),
      tools: [
        {
          definition: tool("boom", "Fails", {}),
          handler: async () => {
            throw "nope";
          },
        },
      ],
    },
    "go",
  );
  expect(toolResults(result.messages)).toEqual(["Error: nope"]);
});

test("approve gates each call and refused calls never reach the handler", async () => {
  const ran: string[] = [];
  const seen: ToolCall[] = [];
  const echo = (name: string) => ({
    definition: tool(name, name, {}),
    handler: async () => {
      ran.push(name);
      return `${name} ok`;
    },
  });
  const result = await runAgent(
    {
      ai: scripted([
        { id: "1", name: "read", arguments: { id: 1 } },
        { id: "2", name: "delete", arguments: { id: 1 } },
      ]),
      tools: [echo("read"), echo("delete")],
      approve: async (call) => {
        seen.push(call);
        return call.name !== "delete";
      },
    },
    "go",
  );
  expect(ran).toEqual(["read"]);
  expect(seen.map((c) => c.name)).toEqual(["read", "delete"]);
  expect(toolResults(result.messages)).toEqual(["read ok", "Error: tool call delete was not approved"]);
});

test("a call with unparseable arguments is reported without running the handler", async () => {
  let ran = false;
  const result = await runAgent(
    {
      ai: scripted([{ id: "1", name: "calc", arguments: {}, error: "tool arguments were not valid JSON" }]),
      tools: [
        {
          definition: tool("calc", "Calc", {}),
          handler: async () => {
            ran = true;
            return "ran";
          },
        },
      ],
    },
    "go",
  );
  expect(ran).toBe(false);
  expect(toolResults(result.messages)).toEqual(["Error: tool arguments were not valid JSON"]);
});

test("parseToolArguments accepts objects and flags everything else", () => {
  expect(parseToolArguments('{"a":1}')).toEqual({ arguments: { a: 1 } });
  expect(parseToolArguments("")).toEqual({ arguments: {} });
  expect(parseToolArguments(undefined)).toEqual({ arguments: {} });
  expect(parseToolArguments('{"a":')).toEqual({ arguments: {}, error: "tool arguments were not valid JSON" });
  expect(parseToolArguments("[1,2]")).toEqual({ arguments: {}, error: "tool arguments must be a JSON object" });
  expect(parseToolArguments("null")).toEqual({ arguments: {}, error: "tool arguments must be a JSON object" });
});

const respond = (body: string | object, type = "application/json") => {
  globalThis.fetch = (async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status: 200,
      headers: { "content-type": type },
    })) as unknown as typeof fetch;
};

const collect = async (stream: AsyncGenerator<StreamChunk>) => {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
};

test("openai chat turns malformed tool arguments into an error", async () => {
  respond({
    model: "gpt",
    choices: [
      {
        message: {
          content: null,
          tool_calls: [{ id: "c1", type: "function", function: { name: "calc", arguments: '{"expression": ' } }],
        },
      },
    ],
  });
  const reply = await createProvider({ provider: "openai", key: "k" }).chat({ messages: [] });
  expect(reply.toolCalls).toEqual([
    { id: "c1", name: "calc", arguments: {}, error: "tool arguments were not valid JSON" },
  ]);
});

test("openai stream keeps going past malformed tool arguments", async () => {
  const events = [
    { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "calc", arguments: "{oops" } }] } }] },
    { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
  ];
  respond(`${events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("")}data: [DONE]\n\n`, "text/event-stream");
  const chunks = await collect(createProvider({ provider: "openai", key: "k" }).chatStream({ messages: [] }));
  expect(chunks).toEqual([
    {
      type: "tool_call",
      toolCall: { id: "c1", name: "calc", arguments: {}, error: "tool arguments were not valid JSON" },
    },
    { type: "done" },
  ]);
});

test("anthropic stream keeps going past malformed tool arguments", async () => {
  const events = [
    { type: "content_block_start", content_block: { type: "tool_use", id: "t1", name: "calc" } },
    { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: '{"expression": "1+' } },
    { type: "content_block_stop" },
    { type: "message_stop" },
  ];
  respond(events.map((e) => `data: ${JSON.stringify(e)}\n`).join(""), "text/event-stream");
  const chunks = await collect(createProvider({ provider: "anthropic", key: "k" }).chatStream({ messages: [] }));
  expect(chunks[0]).toEqual({
    type: "tool_call",
    toolCall: { id: "t1", name: "calc", arguments: {}, error: "tool arguments were not valid JSON" },
  });
});
