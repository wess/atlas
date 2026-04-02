import { expect, test } from "bun:test";
import { createMemoryCache } from "../store/index.ts";

test("set and get value", async () => {
  const cache = createMemoryCache();
  await cache.set("user:1", { name: "Wess" });
  const result = await cache.get("user:1");
  expect(result).toEqual({ name: "Wess" });
});

test("get returns null for missing key", async () => {
  const cache = createMemoryCache();
  expect(await cache.get("nope")).toBeNull();
});

test("del removes a key", async () => {
  const cache = createMemoryCache();
  await cache.set("key", "value");
  await cache.del("key");
  expect(await cache.get("key")).toBeNull();
});

test("flush clears all", async () => {
  const cache = createMemoryCache();
  await cache.set("a", 1);
  await cache.set("b", 2);
  await cache.flush();
  expect(await cache.get("a")).toBeNull();
  expect(await cache.get("b")).toBeNull();
});

test("set with ttl expires", async () => {
  const cache = createMemoryCache();
  await cache.set("temp", "data", { ttl: 0 });
  await new Promise((r) => setTimeout(r, 10));
  expect(await cache.get("temp")).toBeNull();
});

test("expire sets expiration on existing key", async () => {
  const cache = createMemoryCache();
  await cache.set("key", "value");
  await cache.expire("key", 0);
  await new Promise((r) => setTimeout(r, 10));
  expect(await cache.get("key")).toBeNull();
});

test("close clears store", async () => {
  const cache = createMemoryCache();
  await cache.set("a", 1);
  await cache.close();
  expect(await cache.get("a")).toBeNull();
});
