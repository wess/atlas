import { test, expect } from "bun:test";
import { cosineSimilarity, createVectorStore, embed } from "../embeddings/index.ts";
import type { AiProvider } from "../provider/index.ts";

test("cosineSimilarity identical vectors = 1", () => {
  expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
});

test("cosineSimilarity orthogonal = 0", () => {
  expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
});

test("cosineSimilarity opposite = -1", () => {
  expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
});

test("vector store add and search", () => {
  const store = createVectorStore();
  store.add("a", [1, 0, 0], { text: "hello" });
  store.add("b", [0, 1, 0], { text: "world" });
  const results = store.search([1, 0, 0], 1);
  expect(results).toHaveLength(1);
  expect(results[0]!.id).toBe("a");
  expect(results[0]!.score).toBeCloseTo(1);
});

test("vector store size", () => {
  const store = createVectorStore();
  expect(store.size()).toBe(0);
  store.add("a", [1, 0], {});
  expect(store.size()).toBe(1);
  store.add("b", [0, 1], {});
  expect(store.size()).toBe(2);
});

test("vector store search returns sorted by score", () => {
  const store = createVectorStore();
  store.add("a", [1, 0, 0]);
  store.add("b", [0.9, 0.1, 0]);
  store.add("c", [0, 0, 1]);
  const results = store.search([1, 0, 0], 3);
  expect(results[0]!.id).toBe("a");
  expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  expect(results[1]!.score).toBeGreaterThan(results[2]!.score);
});

test("embed calls provider", async () => {
  const mockAi: AiProvider = {
    name: "mock",
    chat: async () => ({ content: "", model: "mock" }),
    chatStream: async function* () {},
    embed: async () => ({ embeddings: [[1, 2, 3]] }),
  };
  const result = await embed(mockAi, "test");
  expect(result).toEqual([[1, 2, 3]]);
});
