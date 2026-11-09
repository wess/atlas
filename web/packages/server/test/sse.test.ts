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

const readText = async (body: unknown, reads: number): Promise<string> => {
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (let i = 0; i < reads; i++) out += decoder.decode((await reader.read()).value);
  reader.releaseLock();
  return out;
};

const open = (ch: ReturnType<typeof createSseChannel>, headers?: Record<string, string>) =>
  ch.pipe(createConn(new Request("http://localhost/events", { headers })));

test("broadcast and send write an id line when given an id", async () => {
  const ch = createSseChannel();
  const conn = open(ch);
  ch.broadcast("tick", { n: 1 }, 7);
  ch.clients()[0]?.send("tock", "x", "abc");
  const text = await readText(conn.body, 3);
  expect(text).toContain('id: 7\nevent: tick\ndata: {"n":1}\n\n');
  expect(text).toContain('id: abc\nevent: tock\ndata: "x"\n\n');
});

test("frames without an id have no id line, bad ids are rejected", () => {
  const ch = createSseChannel();
  open(ch);
  expect(() => ch.broadcast("a", 1, "x\ny")).toThrow("Invalid SSE event id");
  expect(() => ch.broadcast("a", 1)).not.toThrow();
});

test("client exposes the Last-Event-ID header", () => {
  const ch = createSseChannel();
  open(ch, { "last-event-id": "41" });
  expect(ch.clients()[0]?.lastEventId).toBe("41");
});

test("channel heartbeat writes ping comments and stops on cancel", async () => {
  const ch = createSseChannel({ heartbeat: 10 });
  const conn = open(ch);
  const reader = (conn.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  await reader.read();
  expect(decoder.decode((await reader.read()).value)).toBe(": ping\n\n");
  await reader.cancel();
  expect(ch.clients()).toHaveLength(0);
});

test("heartbeat is cleared when a client is closed or dropped as slow", async () => {
  const ch = createSseChannel({ heartbeat: 5 });
  open(ch);
  const closed = ch.clients()[0]!;
  closed.close();
  expect(ch.clients()).toHaveLength(0);
  const slow = open(ch);
  ch.broadcast("big", "x".repeat(256 * 1024));
  expect(ch.clients()).toHaveLength(0);
  await expect((slow.body as ReadableStream).getReader().read()).rejects.toThrow("too slow");
});

test("eventStream heartbeat pings while the generator is idle, cleared on cancel", async () => {
  let finish!: () => void;
  const conn = eventStream(
    createConn(new Request("http://localhost/events")),
    (send) => {
      send("hello", 1, 1);
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    },
    { heartbeat: 10 },
  );
  const reader = (conn.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  expect(decoder.decode((await reader.read()).value)).toBe("id: 1\nevent: hello\ndata: 1\n\n");
  expect(decoder.decode((await reader.read()).value)).toBe(": ping\n\n");
  await reader.cancel();
  finish();
});

test("publish targets only clients with a matching topic; per-client send is targeted", async () => {
  const ch = createSseChannel({ topic: (c) => c.query.room });
  const a = ch.pipe(createConn(new Request("http://localhost/events?room=a")));
  const b = ch.pipe(createConn(new Request("http://localhost/events?room=b")));
  expect(ch.clients().map((c) => c.topic)).toEqual(["a", "b"]);
  ch.publish("a", "msg", "for-a", 1);
  ch.clients()
    .find((c) => c.topic === "b")
    ?.send("msg", "only-b");
  const ta = await readText(a.body, 2);
  const tb = await readText(b.body, 2);
  expect(ta).toContain("for-a");
  expect(ta).not.toContain("only-b");
  expect(tb).toContain("only-b");
  expect(tb).not.toContain("for-a");
});
