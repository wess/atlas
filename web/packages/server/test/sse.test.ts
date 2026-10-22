import { expect, test } from "bun:test";
import { createConn } from "../conn/index.ts";
import { createSseChannel, eventStream } from "../sse/index.ts";

test("createSseChannel creates a channel", () => {
  const ch = createSseChannel();
  expect(typeof ch.broadcast).toBe("function");
  expect(typeof ch.pipe).toBe("function");
  expect(ch.clients()).toHaveLength(0);
});

test("eventStream returns SSE conn", () => {
  const req = new Request("http://localhost/events");
  const conn = createConn(req);
  const result = eventStream(conn, (send) => {
    send("hello", { msg: "world" });
  });
  expect(result.halted).toBe(true);
  expect(result.status).toBe(200);
  expect(result.respHeaders.get("content-type")).toBe("text/event-stream");
  expect(result.body).toBeInstanceOf(ReadableStream);
});

test("SSE channel pipe upgrades conn to SSE", async () => {
  const ch = createSseChannel();
  const req = new Request("http://localhost/events");
  const conn = createConn(req);
  const result = await ch.pipe(conn);
  expect(result.halted).toBe(true);
  expect(result.status).toBe(200);
  expect(result.respHeaders.get("content-type")).toBe("text/event-stream");
  expect(result.respHeaders.get("cache-control")).toBe("no-cache");
  expect(result.body).toBeInstanceOf(ReadableStream);
});

test("slow SSE consumers are disconnected before queues grow without limit", async () => {
  const channel = createSseChannel();
  const conn = channel.pipe(createConn(new Request("http://localhost/events")));
  const body = conn.body as ReadableStream;
  channel.broadcast("update", "x".repeat(256 * 1024));
  expect(channel.clients()).toHaveLength(0);
  await expect(body.getReader().read()).rejects.toThrow("too slow");
});

test("SSE generator errors reach the reader and cancellation makes sends harmless", async () => {
  const conn = eventStream(createConn(new Request("http://localhost/events")), async () => {
    throw new Error("failed");
  });
  await expect((conn.body as ReadableStream).getReader().read()).rejects.toThrow("failed");
  let send!: (event: string, data: unknown) => void;
  let finish!: () => void;
  const result = eventStream(createConn(new Request("http://localhost/events")), async (sender) => {
    send = sender;
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  await (result.body as ReadableStream).cancel();
  expect(() => send("update", "ignored")).not.toThrow();
  finish();
});
