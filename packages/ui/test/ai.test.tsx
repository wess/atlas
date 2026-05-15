import { expect, test } from "bun:test";
import { AiSearch, ChatWindow, GenerateButton, MessageBubble, PromptInput } from "../ai/index.tsx";

test("ChatWindow is a function", () => {
  expect(typeof ChatWindow).toBe("function");
});

test("MessageBubble is a function", () => {
  expect(typeof MessageBubble).toBe("function");
});

test("PromptInput is a function", () => {
  expect(typeof PromptInput).toBe("function");
});

test("AiSearch is a function", () => {
  expect(typeof AiSearch).toBe("function");
});

test("GenerateButton is a function", () => {
  expect(typeof GenerateButton).toBe("function");
});
