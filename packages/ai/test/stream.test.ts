import { test, expect } from "bun:test";
import { collectStream, streamToSse } from "../stream/index.ts";
import type { StreamChunk } from "../provider/index.ts";

test("collectStream assembles text chunks", async () => {
  async function* chunks(): AsyncGenerator<StreamChunk> {
    yield { type: "text", content: "Hello" };
    yield { type: "text", content: " world" };
    yield { type: "done" };
  }
  const result = await collectStream(chunks());
  expect(result.content).toBe("Hello world");
});

test("collectStream collects tool calls", async () => {
  async function* chunks(): AsyncGenerator<StreamChunk> {
    yield { type: "tool_call", toolCall: { id: "1", name: "search", arguments: { q: "test" } } };
    yield { type: "done" };
  }
  const result = await collectStream(chunks());
  expect(result.toolCalls).toHaveLength(1);
  expect(result.toolCalls![0]!.name).toBe("search");
});

test("collectStream returns undefined toolCalls when none", async () => {
  async function* chunks(): AsyncGenerator<StreamChunk> {
    yield { type: "text", content: "hi" };
    yield { type: "done" };
  }
  const result = await collectStream(chunks());
  expect(result.toolCalls).toBeUndefined();
});

test("streamToSse creates ReadableStream", () => {
  async function* chunks(): AsyncGenerator<StreamChunk> {
    yield { type: "text", content: "hi" };
  }
  const stream = streamToSse(chunks());
  expect(stream).toBeInstanceOf(ReadableStream);
});

test("streamToSse outputs SSE format", async () => {
  async function* chunks(): AsyncGenerator<StreamChunk> {
    yield { type: "text", content: "hi" };
  }
  const stream = streamToSse(chunks());
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const { value } = await reader.read();
  const text = decoder.decode(value);
  expect(text).toContain("data: ");
  expect(text).toContain('"type":"text"');
});
