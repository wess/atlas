import { expect, test } from "bun:test";
import { createConn, json } from "../../server/index.ts";
import { createMemoryIntentStore, socialAuth } from "../social/index.ts";
import type { SocialProvider } from "../social/providers/index.ts";

test("redirect intent is provider-bound, single-use, expiring, and bounded", async () => {
  const store = createMemoryIntentStore({ maxEntries: 2 });
  const expires = Date.now() + 60_000;
  await store.remember("one", "a", "/first", expires);
  expect(await store.take("two", "a")).toBeUndefined();
  expect(await store.take("one", "a")).toBe("/first");
  expect(await store.take("one", "a")).toBeUndefined();
  await store.remember("one", "expired", "/old", Date.now() - 1);
  expect(await store.take("one", "expired")).toBeUndefined();
  await store.remember("one", "oversized", "x".repeat(4097), expires);
  expect(await store.take("one", "oversized")).toBeUndefined();
  await store.remember("one", "a", "/first", expires);
  await store.remember("one", "b", "/second", expires);
  await store.remember("one", "c", "/third", expires);
  expect(await store.take("one", "a")).toBeUndefined();
  expect(await store.take("one", "b")).toBe("/second");
  expect(await store.take("one", "c")).toBe("/third");
});

test("a missing auth cookie restores only an error redirect, never authentication", async () => {
  let exchanges = 0;
  const provider: SocialProvider = {
    name: "mock",
    config: {},
    defaultScopes: [],
    authorizeUrl: ({ state }) => `https://provider.test/auth?state=${state}`,
    exchange: async () => {
      exchanges++;
      throw new Error("must not exchange");
    },
    profile: async () => {
      throw new Error("must not load a profile");
    },
  };
  const store = createMemoryIntentStore();
  const social = socialAuth({ secret: "test-intent-secret", providers: { mock: provider }, intentStore: store });
  const { url } = await social.authorize("mock", { returnTo: "native://callback" });
  const state = new URL(url).searchParams.get("state")!;
  expect(state).not.toContain(".");
  const callback = social.callback("mock", {
    onSuccess: () => {
      throw new Error("must not sign in");
    },
    onError: (conn, error, context) => json(conn, 400, { error: error.message, returnTo: context.returnTo }),
  });
  const response = await callback(createConn(new Request(`http://localhost/cb?code=bad&state=${state}`)));
  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({ returnTo: "native://callback" });
  expect(exchanges).toBe(0);
  expect(await store.take("mock", state)).toBeUndefined();
});
