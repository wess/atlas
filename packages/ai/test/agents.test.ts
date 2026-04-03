import { test, expect } from "bun:test";
import { runAgent } from "../agents/index.ts";
import { tool } from "../structured/index.ts";
import type { AiProvider } from "../provider/index.ts";

test("runAgent completes without tools", async () => {
  const mockAi: AiProvider = {
    name: "mock",
    chat: async () => ({ content: "done", model: "mock" }),
    chatStream: async function* () {},
    embed: async () => ({ embeddings: [] }),
  };
  const result = await runAgent({ ai: mockAi, tools: [] }, "hello");
  expect(result.response).toBe("done");
  expect(result.iterations).toBe(1);
});

test("runAgent executes tool calls", async () => {
  let callCount = 0;
  const mockAi: AiProvider = {
    name: "mock",
    chat: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          content: "",
          model: "mock",
          toolCalls: [{ id: "1", name: "calc", arguments: { x: 5 } }],
        };
      }
      return { content: "result is 10", model: "mock" };
    },
    chatStream: async function* () {},
    embed: async () => ({ embeddings: [] }),
  };
  const result = await runAgent(
    {
      ai: mockAi,
      tools: [
        {
          definition: tool("calc", "Calculate", {}),
          handler: async (args) => String((args.x as number) * 2),
        },
      ],
    },
    "what is 5*2",
  );
  expect(result.response).toBe("result is 10");
  expect(result.iterations).toBe(2);
});

test("runAgent handles unknown tool gracefully", async () => {
  let callCount = 0;
  const mockAi: AiProvider = {
    name: "mock",
    chat: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          content: "",
          model: "mock",
          toolCalls: [{ id: "1", name: "unknown", arguments: {} }],
        };
      }
      return { content: "handled", model: "mock" };
    },
    chatStream: async function* () {},
    embed: async () => ({ embeddings: [] }),
  };
  const result = await runAgent({ ai: mockAi, tools: [] }, "test");
  expect(result.response).toBe("handled");
});

test("runAgent respects maxIterations", async () => {
  const mockAi: AiProvider = {
    name: "mock",
    chat: async () => ({
      content: "",
      model: "mock",
      toolCalls: [{ id: "1", name: "loop", arguments: {} }],
    }),
    chatStream: async function* () {},
    embed: async () => ({ embeddings: [] }),
  };
  const result = await runAgent(
    {
      ai: mockAi,
      tools: [
        {
          definition: tool("loop", "Loop forever", {}),
          handler: async () => "looping",
        },
      ],
      maxIterations: 3,
    },
    "loop",
  );
  expect(result.response).toBe("Max iterations reached");
  expect(result.iterations).toBe(3);
});

test("runAgent includes system message when provided", async () => {
  let capturedMessages: any[] = [];
  const mockAi: AiProvider = {
    name: "mock",
    chat: async (opts) => {
      capturedMessages = [...opts.messages];
      return { content: "done", model: "mock" };
    },
    chatStream: async function* () {},
    embed: async () => ({ embeddings: [] }),
  };
  await runAgent({ ai: mockAi, tools: [], system: "be concise" }, "hello");
  expect(capturedMessages[0]!.role).toBe("system");
  expect(capturedMessages[0]!.content).toBe("be concise");
});
