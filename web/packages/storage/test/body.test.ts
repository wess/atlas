import { afterEach, expect, test } from "bun:test";
import { stat } from "node:fs/promises";
import { dirname } from "node:path";
import { createStore, upload } from "../index.ts";
import { sha256 } from "../signing/index.ts";

const store = createStore({
  endpoint: "https://s3.example.test",
  bucket: "test",
  accessKey: "key",
  secretKey: "secret",
});
const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});

test("Blob uploads hash a stream and replay the original Blob without materializing it", async () => {
  const body = new Blob(["hello", "world"]);
  body.arrayBuffer = async () => {
    throw new Error("must not buffer the Blob");
  };
  globalThis.fetch = (async (_url, init) => {
    expect(init!.body).toBe(body);
    expect(new Headers(init!.headers).get("x-amz-content-sha256")).toBe(sha256("helloworld"));
    expect(await Bun.readableStreamToText(body.stream())).toBe("helloworld");
    return new Response(null);
  }) as typeof fetch;
  await upload(store, { key: "blob", body });
});

test("one-shot streams use private temporary storage and remove it after the request", async () => {
  let path = "";
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("hello"));
      controller.close();
    },
  });
  globalThis.fetch = (async (_url, init) => {
    const file = init!.body as unknown as Bun.BunFile;
    path = file.name!;
    expect(await file.text()).toBe("hello");
    expect(new Headers(init!.headers).get("x-amz-content-sha256")).toBe(sha256("hello"));
    if (process.platform !== "win32") expect((await stat(dirname(path))).mode & 0o777).toBe(0o700);
    return new Response(null);
  }) as typeof fetch;
  await upload(store, { key: "stream", body });
  expect(await Bun.file(path).exists()).toBe(false);
  await expect(stat(dirname(path))).rejects.toThrow();
});

test("temporary uploads are removed when the network fails", async () => {
  let path = "";
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    path = (init!.body as unknown as Bun.BunFile).name!;
    throw new Error("network unavailable");
  }) as unknown as typeof fetch;
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array([1, 2]));
      c.close();
    },
  });
  await expect(upload(store, { key: "failure", body })).rejects.toThrow("network unavailable");
  expect(await Bun.file(path).exists()).toBe(false);
});

test("upload limits reject before fetch and cancel an oversized producer", async () => {
  let fetched = false;
  let cancelled = false;
  globalThis.fetch = (async () => {
    fetched = true;
    return new Response(null);
  }) as unknown as typeof fetch;
  const body = new ReadableStream({
    pull(c) {
      c.enqueue(new Uint8Array(32));
    },
    cancel() {
      cancelled = true;
    },
  });
  await expect(upload(store, { key: "too-large", body, maxBytes: 16 })).rejects.toThrow("maxBytes");
  expect(cancelled).toBe(true);
  expect(fetched).toBe(false);
  await expect(upload(store, { key: "blob", body: new Blob(["large"]), maxBytes: 2 })).rejects.toThrow("maxBytes");
});

test("aborting an unfinished producer cancels it without sending a request", async () => {
  const controller = new AbortController();
  let cancelled = false;
  let fetched = false;
  globalThis.fetch = (async () => {
    fetched = true;
    return new Response(null);
  }) as unknown as typeof fetch;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  const pending = upload(store, { key: "cancel", body, signal: controller.signal });
  setTimeout(() => controller.abort(new Error("upload cancelled")), 10);
  await expect(pending).rejects.toThrow("upload cancelled");
  expect(cancelled).toBe(true);
  expect(fetched).toBe(false);
});

test("empty and multi-chunk streams arrive over HTTP with matching payload hashes", async () => {
  const received: string[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const bytes = new Uint8Array(await request.arrayBuffer());
      expect(request.headers.get("x-amz-content-sha256")).toBe(sha256(bytes));
      received.push(new TextDecoder().decode(bytes));
      return new Response(null);
    },
  });
  try {
    const local = { ...store, endpoint: server.url.origin };
    await upload(local, {
      key: "empty",
      body: new ReadableStream({
        start(c) {
          c.close();
        },
      }),
    });
    await upload(local, {
      key: "chunks",
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("one"));
          c.enqueue(new TextEncoder().encode("two"));
          c.close();
        },
      }),
    });
    expect(received).toEqual(["", "onetwo"]);
  } finally {
    await server.stop(true);
  }
});
