import { test, expect } from "bun:test";
import { createProvider } from "../provider/index.ts";

test("createProvider throws on unknown provider", () => {
  expect(() => createProvider({ provider: "nope" as any })).toThrow("Unknown provider");
});

test("createProvider creates openai provider", () => {
  const ai = createProvider({ provider: "openai", key: "test-key" });
  expect(ai.name).toBe("openai");
  expect(typeof ai.chat).toBe("function");
  expect(typeof ai.chatStream).toBe("function");
  expect(typeof ai.embed).toBe("function");
});

test("createProvider creates anthropic provider", () => {
  const ai = createProvider({ provider: "anthropic", key: "test-key" });
  expect(ai.name).toBe("anthropic");
  expect(typeof ai.chat).toBe("function");
  expect(typeof ai.chatStream).toBe("function");
  expect(typeof ai.embed).toBe("function");
});

test("createProvider creates ollama provider", () => {
  const ai = createProvider({ provider: "ollama" });
  expect(ai.name).toBe("ollama");
  expect(typeof ai.chat).toBe("function");
  expect(typeof ai.chatStream).toBe("function");
  expect(typeof ai.embed).toBe("function");
});

test("anthropic embed throws helpful error", async () => {
  const ai = createProvider({ provider: "anthropic", key: "test-key" });
  await expect(ai.embed({ input: "test" })).rejects.toThrow("does not support embeddings");
});
