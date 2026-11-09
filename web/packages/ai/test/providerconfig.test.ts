import { afterEach, expect, test } from "bun:test";
import { createProvider } from "../provider/index.ts";

const real = globalThis.fetch;
type Seen = { url: string; headers: Record<string, string> };

const capture = (reply: unknown): Seen[] => {
  const seen: Seen[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen.push({ url: String(url), headers: init.headers as Record<string, string> });
    return new Response(JSON.stringify(reply), { status: 200 });
  }) as unknown as typeof fetch;
  return seen;
};

afterEach(() => {
  globalThis.fetch = real;
});

const ollamaReply = { message: { content: "hi" }, embedding: [1, 2] };

test("ollama sends bearer key on chat and embed", async () => {
  const seen = capture(ollamaReply);
  const ai = createProvider({ provider: "ollama", key: "k1", baseUrl: "https://ollama.com/" });
  await ai.chat({ messages: [{ role: "user", content: "x" }] });
  await ai.embed({ input: "x" });
  expect(seen.map((s) => s.url)).toEqual(["https://ollama.com/api/chat", "https://ollama.com/api/embeddings"]);
  for (const s of seen) expect(s.headers.Authorization).toBe("Bearer k1");
});

test("ollama sends bearer key on chatStream", async () => {
  const seen: Seen[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen.push({ url: String(url), headers: init.headers as Record<string, string> });
    return new Response('{"done":true}\n', { status: 200 });
  }) as unknown as typeof fetch;
  const ai = createProvider({ provider: "ollama", key: "k2" });
  for await (const _ of ai.chatStream({ messages: [{ role: "user", content: "x" }] })) {
  }
  expect(seen[0]?.headers.Authorization).toBe("Bearer k2");
});

test("ollama without key sends no authorization", async () => {
  const seen = capture(ollamaReply);
  await createProvider({ provider: "ollama" }).chat({ messages: [{ role: "user", content: "x" }] });
  expect(seen[0]?.url).toBe("http://localhost:11434/api/chat");
  expect(seen[0]?.headers.Authorization).toBeUndefined();
});

test("anthropic honors baseUrl and defaults to api.anthropic.com", async () => {
  const reply = { content: [{ type: "text", text: "ok" }], model: "m" };
  const seen = capture(reply);
  const msg = { messages: [{ role: "user" as const, content: "x" }] };
  await createProvider({ provider: "anthropic", key: "k", baseUrl: "https://proxy.test/" }).chat(msg);
  await createProvider({ provider: "anthropic", key: "k" }).chat(msg);
  expect(seen[0]?.url).toBe("https://proxy.test/v1/messages");
  expect(seen[1]?.url).toBe("https://api.anthropic.com/v1/messages");
});
