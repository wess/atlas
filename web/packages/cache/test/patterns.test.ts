import { expect, test } from "bun:test";
import { cached, invalidate } from "../patterns/index.ts";
import { createMemoryCache } from "../store/index.ts";

test("cached fetches and caches result", async () => {
  const cache = createMemoryCache();
  let calls = 0;
  const getUser = cached(cache, "user", async (id: string) => {
    calls++;
    return { id, name: "Wess" };
  });

  const first = await getUser("1");
  expect(first).toEqual({ id: "1", name: "Wess" });
  expect(calls).toBe(1);

  const second = await getUser("1");
  expect(second).toEqual({ id: "1", name: "Wess" });
  expect(calls).toBe(1);
});

test("invalidate busts cache", async () => {
  const cache = createMemoryCache();
  let calls = 0;
  const getUser = cached(cache, "user", async (id: string) => {
    calls++;
    return { id, name: `User${calls}` };
  });

  await getUser("1");
  expect(calls).toBe(1);

  await invalidate(cache, "user", "1");
  await getUser("1");
  expect(calls).toBe(2);
});

test("cached with different args uses different keys", async () => {
  const cache = createMemoryCache();
  const fn = cached(cache, "item", async (id: string) => ({ id }));

  const a = await fn("a");
  const b = await fn("b");
  expect(a).toEqual({ id: "a" });
  expect(b).toEqual({ id: "b" });
});

test("cached respects ttl option", async () => {
  const cache = createMemoryCache();
  let calls = 0;
  const fn = cached(
    cache,
    "exp",
    async (id: string) => {
      calls++;
      return { id };
    },
    { ttl: 0 },
  );

  await fn("1");
  expect(calls).toBe(1);

  await new Promise((r) => setTimeout(r, 10));
  await fn("1");
  expect(calls).toBe(2);
});

test("concurrent cache misses share one load and failed loads can be retried", async () => {
  let loads = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const get = cached(createMemoryCache(), "item", async (id: string) => {
    loads++;
    await gate;
    return id;
  });
  const requests = Array.from({ length: 100 }, () => get("same"));
  release();
  expect(await Promise.all(requests)).toHaveLength(100);
  expect(loads).toBe(1);
  let tries = 0;
  const retry = cached(createMemoryCache(), "retry", async () => {
    if (++tries === 1) throw new Error("offline");
    return "ok";
  });
  await expect(retry()).rejects.toThrow("offline");
  expect(await retry()).toBe("ok");
});

test("object arguments and primitive types cannot share cached results", async () => {
  const get = cached(createMemoryCache(), "user", async (input: unknown) => input);
  expect(await get({ id: 1 })).toEqual({ id: 1 });
  expect(await get({ id: 2 })).toEqual({ id: 2 });
  expect(await get(1)).toBe(1);
  expect(await get("1")).toBe("1");
});
