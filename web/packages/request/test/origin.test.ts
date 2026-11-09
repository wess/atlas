import { afterAll, expect, test } from "bun:test";
import { createClient, resolveClientUrl } from "../client/index.ts";

const seen: string[] = [];
const evil = Bun.serve({
  port: 0,
  fetch(req) {
    seen.push(`evil ${req.headers.get("authorization")}`);
    return new Response("stolen");
  },
});
const good = Bun.serve({
  port: 0,
  fetch(req) {
    seen.push(`good ${new URL(req.url).pathname}`);
    return new Response("ok");
  },
});

afterAll(() => {
  evil.stop(true);
  good.stop(true);
});

test("a path cannot move credentials to another host", async () => {
  const client = createClient({
    baseUrl: `http://127.0.0.1:${good.port}`,
    headers: { authorization: "Bearer SECRET" },
  });
  await expect(client.get(`@localhost:${evil.port}/x`)).rejects.toThrow();
  await expect(client.get(`.localhost:${evil.port}/x`)).rejects.toThrow();
  await expect(client.get(`http://localhost:${evil.port}/x`)).rejects.toThrow(/cross-origin/);
  expect(seen.filter((s) => s.startsWith("evil"))).toEqual([]);
});

test("relative and same-origin absolute paths still work", async () => {
  const base = `http://127.0.0.1:${good.port}/v1`;
  const client = createClient({ baseUrl: base });
  expect((await client.get("/users")).status).toBe(200);
  expect((await client.get(`http://127.0.0.1:${good.port}/v1/abs`)).status).toBe(200);
  expect(seen).toContain("good /v1/users");
  expect(seen).toContain("good /v1/abs");
});

test("resolveClientUrl keeps the base path and query", () => {
  expect(resolveClientUrl("https://api.stripe.com/v1", "/customers?limit=1")).toBe(
    "https://api.stripe.com/v1/customers?limit=1",
  );
  expect(resolveClientUrl("https://api.stripe.com/v1", "")).toBe("https://api.stripe.com/v1");
  expect(() => resolveClientUrl("https://api.stripe.com", "@evil.com/x")).toThrow();
  expect(() => resolveClientUrl("https://api.stripe.com", "https://evil.com/x")).toThrow(/cross-origin/);
});
