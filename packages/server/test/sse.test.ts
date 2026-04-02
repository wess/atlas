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

test("SSE channel pipe upgrades conn to SSE", () => {
  const ch = createSseChannel();
  const req = new Request("http://localhost/events");
  const conn = createConn(req);
  const result = ch.pipe(conn);
  expect(result.halted).toBe(true);
  expect(result.status).toBe(200);
  expect(result.respHeaders.get("content-type")).toBe("text/event-stream");
  expect(result.respHeaders.get("cache-control")).toBe("no-cache");
  expect(result.body).toBeInstanceOf(ReadableStream);
});
