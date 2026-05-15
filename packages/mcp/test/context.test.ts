import { expect, test } from "bun:test";
import { createContext } from "../context/index.ts";

test("createContext with defaults", () => {
  const ctx = createContext();
  expect(ctx.logBuffer).toEqual([]);
  expect(ctx.db).toBeUndefined();
  expect(ctx.cache).toBeUndefined();
});

test("createContext with db", () => {
  const mockDb = { dialect: "sqlite" } as any;
  const ctx = createContext({ db: mockDb });
  expect(ctx.db).toBe(mockDb);
});

test("createContext preserves provided logBuffer", () => {
  const ctx = createContext({ logBuffer: ["line1", "line2"] });
  expect(ctx.logBuffer).toEqual(["line1", "line2"]);
});

test("createContext with config", () => {
  const cfg = { port: 3000 };
  const ctx = createContext({ config: cfg });
  expect(ctx.config).toBe(cfg);
});
