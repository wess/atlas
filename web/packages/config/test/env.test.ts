import { expect, test } from "bun:test";
import { env } from "../env.ts";

test("env reads a string value from Bun.env", () => {
  process.env.TEST_VAR = "hello";
  const result = env("TEST_VAR");
  expect(result.read()).toBe("hello");
  delete process.env.TEST_VAR;
});

test("env throws on missing required var", () => {
  const result = env("MISSING_VAR");
  expect(() => result.read()).toThrow("Missing required environment variable: MISSING_VAR");
});

test("env returns default when var is missing", () => {
  const result = env("MISSING_VAR", { default: "fallback" });
  expect(result.read()).toBe("fallback");
});

test("env parses value with parse function", () => {
  process.env.TEST_NUM = "42";
  const result = env("TEST_NUM", { parse: Number });
  expect(result.read()).toBe(42);
  delete process.env.TEST_NUM;
});

test("env parses default value too", () => {
  const result = env("MISSING_NUM", { parse: Number, default: "5" });
  expect(result.read()).toBe(5);
});
