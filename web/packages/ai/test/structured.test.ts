import { expect, test } from "bun:test";
import type { AiProvider } from "../provider/index.ts";
import { generateJson, tool } from "../structured/index.ts";

test("tool creates a tool definition", () => {
  const t = tool("search", "Search the web", {
    type: "object",
    properties: { query: { type: "string" } },
  });
  expect(t.name).toBe("search");
  expect(t.description).toBe("Search the web");
  expect(t.parameters).toEqual({
    type: "object",
    properties: { query: { type: "string" } },
  });
});

test("generateJson parses response as JSON", async () => {
  const mockAi: AiProvider = {
    name: "mock",
    chat: async () => ({ content: '{"name":"Alice","age":30}', model: "mock" }),
    chatStream: async function* () {},
    embed: async () => ({ embeddings: [] }),
  };
  const result = await generateJson<{ name: string; age: number }>(mockAi, "get user");
  expect(result.name).toBe("Alice");
  expect(result.age).toBe(30);
});

test("generateJson passes jsonMode to provider", async () => {
  let capturedOpts: any;
  const mockAi: AiProvider = {
    name: "mock",
    chat: async (opts) => {
      capturedOpts = opts;
      return { content: "{}", model: "mock" };
    },
    chatStream: async function* () {},
    embed: async () => ({ embeddings: [] }),
  };
  await generateJson(mockAi, "get data");
  expect(capturedOpts.jsonMode).toBe(true);
});
