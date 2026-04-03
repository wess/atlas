import { test, expect } from "bun:test";
import {
  createConversation,
  addMessage,
  send,
  userMessage,
  assistantMessage,
  systemMessage,
  toolMessage,
} from "../chat/index.ts";
import type { AiProvider } from "../provider/index.ts";

const mockAi: AiProvider = {
  name: "mock",
  chat: async () => ({ content: "hi", model: "mock" }),
  chatStream: async function* () {},
  embed: async () => ({ embeddings: [] }),
};

test("createConversation creates empty with system", () => {
  const conv = createConversation("You are helpful");
  expect(conv.messages).toEqual([]);
  expect(conv.system).toBe("You are helpful");
});

test("createConversation creates empty without system", () => {
  const conv = createConversation();
  expect(conv.messages).toEqual([]);
  expect(conv.system).toBeUndefined();
});

test("addMessage appends immutably", () => {
  const conv = createConversation();
  const msg = userMessage("hello");
  const updated = addMessage(conv, msg);
  expect(updated.messages).toHaveLength(1);
  expect(conv.messages).toHaveLength(0);
  expect(updated.messages[0]).toEqual(msg);
});

test("userMessage creates user role", () => {
  const msg = userMessage("hello");
  expect(msg.role).toBe("user");
  expect(msg.content).toBe("hello");
});

test("assistantMessage creates assistant role", () => {
  const msg = assistantMessage("hi");
  expect(msg.role).toBe("assistant");
  expect(msg.content).toBe("hi");
});

test("systemMessage creates system role", () => {
  const msg = systemMessage("be helpful");
  expect(msg.role).toBe("system");
  expect(msg.content).toBe("be helpful");
});

test("toolMessage creates tool role with id", () => {
  const msg = toolMessage("call-1", "result");
  expect(msg.role).toBe("tool");
  expect(msg.content).toBe("result");
  expect(msg.toolCallId).toBe("call-1");
});

test("send adds user and assistant messages", async () => {
  const conv = createConversation();
  const { conversation, response } = await send(mockAi, conv, "hello");
  expect(conversation.messages).toHaveLength(2);
  expect(conversation.messages[0]!.role).toBe("user");
  expect(conversation.messages[1]!.role).toBe("assistant");
  expect(response.content).toBe("hi");
});

test("send includes system message when present", async () => {
  let capturedMessages: any[] = [];
  const spyAi: AiProvider = {
    name: "spy",
    chat: async (opts) => {
      capturedMessages = [...opts.messages];
      return { content: "ok", model: "spy" };
    },
    chatStream: async function* () {},
    embed: async () => ({ embeddings: [] }),
  };
  const conv = createConversation("be helpful");
  await send(spyAi, conv, "hello");
  expect(capturedMessages[0]!.role).toBe("system");
  expect(capturedMessages[0]!.content).toBe("be helpful");
});
