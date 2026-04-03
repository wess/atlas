import { test, expect } from "bun:test";
import { index, query } from "../rag/index.ts";
import { createVectorStore } from "../embeddings/index.ts";
import type { AiProvider } from "../provider/index.ts";

const mockAi: AiProvider = {
  name: "mock",
  chat: async () => ({ content: "The answer is 42", model: "mock" }),
  chatStream: async function* () {},
  embed: async () => ({ embeddings: [[1, 0, 0]] }),
};

test("index adds document to store", async () => {
  const store = createVectorStore();
  const rag = { ai: mockAi, store };
  await index(rag, "doc1", "The meaning of life is 42");
  expect(store.size()).toBe(1);
});

test("index and query work together", async () => {
  const store = createVectorStore();
  const rag = { ai: mockAi, store };

  await index(rag, "doc1", "The meaning of life is 42");
  expect(store.size()).toBe(1);

  const result = await query(rag, "what is the meaning of life?");
  expect(result.answer).toBe("The answer is 42");
  expect(result.sources).toHaveLength(1);
  expect(result.sources[0]!.id).toBe("doc1");
});

test("query includes sources with scores", async () => {
  const store = createVectorStore();
  const rag = { ai: mockAi, store };

  await index(rag, "doc1", "first doc");
  await index(rag, "doc2", "second doc");

  const result = await query(rag, "question");
  expect(result.sources).toHaveLength(2);
  expect(result.sources[0]!.score).toBeDefined();
});

test("query passes context to chat", async () => {
  let capturedMessages: any[] = [];
  const spyAi: AiProvider = {
    name: "spy",
    chat: async (opts) => {
      capturedMessages = [...opts.messages];
      return { content: "answer", model: "spy" };
    },
    chatStream: async function* () {},
    embed: async () => ({ embeddings: [[1, 0, 0]] }),
  };
  const store = createVectorStore();
  const rag = { ai: spyAi, store };

  await index(rag, "doc1", "some context");
  await query(rag, "question");

  expect(capturedMessages[0]!.role).toBe("system");
  expect(capturedMessages[0]!.content).toContain("some context");
  expect(capturedMessages[1]!.role).toBe("user");
  expect(capturedMessages[1]!.content).toBe("question");
});
