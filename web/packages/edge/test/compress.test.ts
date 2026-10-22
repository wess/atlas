import { expect, test } from "bun:test";
import { compressResponse } from "../compress/index.ts";

const response = (headers: Record<string, string> = {}) =>
  new Response("hello ".repeat(500), {
    headers: { "content-type": "text/plain", ...headers },
  });

test("gzip streams before the source finishes and preserves its contents", async () => {
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const input = new ReadableStream<Uint8Array>({
    start(controller) {
      source = controller;
    },
  });
  const output = await compressResponse(new Response(input, { headers: { "content-type": "text/plain" } }), "gzip", [
    "gzip",
  ]);
  expect(output.headers.get("content-encoding")).toBe("gzip");
  source.enqueue(new TextEncoder().encode("hello"));
  source.close();
  const text = await new Response(output.body!.pipeThrough(new DecompressionStream("gzip"))).text();
  expect(text).toBe("hello");
});

test("compression respects q=0, partial responses, event streams and no-transform", async () => {
  expect((await compressResponse(response(), "gzip;q=0", ["gzip"])).headers.has("content-encoding")).toBe(false);
  expect(
    (await compressResponse(response({ "content-type": "text/event-stream" }), "gzip", ["gzip"])).headers.has(
      "content-encoding",
    ),
  ).toBe(false);
  expect(
    (await compressResponse(response({ "cache-control": "no-transform" }), "gzip", ["gzip"])).headers.has(
      "content-encoding",
    ),
  ).toBe(false);
  const partial = new Response("part", { status: 206, headers: { "content-type": "text/plain" } });
  expect(await compressResponse(partial, "gzip", ["gzip"])).toBe(partial);
});

test("transformed responses discard stale length and validators", async () => {
  const res = await compressResponse(response({ "content-length": "3000", etag: '"original"' }), "gzip", ["gzip"]);
  expect(res.headers.get("content-length")).toBeNull();
  expect(res.headers.get("etag")).toBeNull();
  expect(await new Response(res.body!.pipeThrough(new DecompressionStream("gzip"))).text()).toBe("hello ".repeat(500));
});

test("zstd refuses to buffer unbounded responses and survives false lengths", async () => {
  const unknown = response();
  expect((await compressResponse(unknown, "zstd", ["zstd"])).headers.has("content-encoding")).toBe(false);
  const body = "x".repeat(2 * 1024 * 1024);
  const res = await compressResponse(
    new Response(body, { headers: { "content-type": "text/plain", "content-length": "2048" } }),
    "zstd",
    ["zstd"],
  );
  expect(res.headers.has("content-encoding")).toBe(false);
  expect(await res.text()).toBe(body);
});
