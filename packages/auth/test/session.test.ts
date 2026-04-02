import { expect, test } from "bun:test";
import { createMemoryStore } from "../session/index.ts";

test("create, get, destroy session", async () => {
  const store = createMemoryStore();
  const id = await store.create({ userId: 1 });
  expect(await store.get(id)).toEqual({ userId: 1 });
  await store.destroy(id);
  expect(await store.get(id)).toBeNull();
});

test("get returns null for unknown id", async () => {
  const store = createMemoryStore();
  expect(await store.get("nonexistent")).toBeNull();
});

test("create returns unique ids", async () => {
  const store = createMemoryStore();
  const a = await store.create({ a: 1 });
  const b = await store.create({ b: 2 });
  expect(a).not.toBe(b);
});
