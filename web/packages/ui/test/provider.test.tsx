import { expect, test } from "bun:test";
import { AppShell, AtlasProvider } from "../provider/index.tsx";

test("AtlasProvider is a function", () => {
  expect(typeof AtlasProvider).toBe("function");
});

test("AppShell is a function", () => {
  expect(typeof AppShell).toBe("function");
});
