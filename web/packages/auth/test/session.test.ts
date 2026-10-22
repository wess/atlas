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

test("ttl expires sessions", async () => {
  const store = createMemoryStore({ ttl: 0.05 });
  const id = await store.create({ userId: 1 });
  expect(await store.get(id)).toEqual({ userId: 1 });
  await Bun.sleep(80);
  expect(await store.get(id)).toBeNull();
});

test("no ttl keeps sessions alive", async () => {
  const store = createMemoryStore();
  const id = await store.create({ userId: 1 });
  await Bun.sleep(80);
  expect(await store.get(id)).toEqual({ userId: 1 });
});

test("memory sessions refuse excess entries and reclaim destroyed slots", async () => {
  const store = createMemoryStore({ maxEntries: 1 });
  const first = await store.create({ userId: 1 });
  await expect(store.create({ userId: 2 })).rejects.toThrow("capacity");
  expect((await store.get(first))?.userId).toBe(1);
  await store.destroy(first);
  expect(await store.get(await store.create({ userId: 2 }))).toEqual({ userId: 2 });
});
