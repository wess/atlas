import { afterEach, expect, test } from "bun:test";
import { stat } from "../operations/index.ts";
import { createStore } from "../store/index.ts";

const store = createStore({
  endpoint: "http://localhost:9000",
  bucket: "test",
  accessKey: "minioadmin",
  secretKey: "minioadmin",
  region: "us-east-1",
});

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});

const respond = (response: Response) => {
  const seen: Array<{ method: string; url: string; auth: string | null }> = [];
  globalThis.fetch = (async (input, init) => {
    seen.push({
      method: init?.method ?? "GET",
      url: String(input),
      auth: new Headers(init?.headers).get("authorization"),
    });
    return response;
  }) as typeof fetch;
  return seen;
};

test("stat sends a signed HEAD and reads size and type", async () => {
  const seen = respond(
    new Response(null, { headers: { "content-length": "2048", "content-type": "application/zip", etag: '"abc"' } }),
  );
  expect(await stat(store, "files/brushes.zip")).toEqual({ size: 2048, contentType: "application/zip", etag: '"abc"' });
  expect(seen[0]).toMatchObject({ method: "HEAD", url: "http://localhost:9000/test/files/brushes.zip" });
  expect(seen[0]?.auth).toStartWith("AWS4-HMAC-SHA256");
});

test("stat is null for a missing object and throws on other failures", async () => {
  respond(new Response(null, { status: 404 }));
  expect(await stat(store, "missing")).toBeNull();
  respond(new Response(null, { status: 403 }));
  await expect(stat(store, "denied")).rejects.toThrow("HTTP 403");
});
