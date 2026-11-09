import type { Conn } from "../conn/index.ts";

const encoder = new TextEncoder();
const MAX_QUEUE_BYTES = 256 * 1024;

export type SseId = string | number;

const frame = (event: string, data: unknown, id?: SseId): Uint8Array => {
  if (/[\r\n]/.test(event)) throw new Error("Invalid SSE event name");
  if (id !== undefined && /[\r\n\0]/.test(String(id))) throw new Error("Invalid SSE event id");
  const idLine = id === undefined ? "" : `id: ${id}\n`;
  return encoder.encode(`${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

const ping = encoder.encode(": ping\n\n");

export type SseOptions = {
  // ms between `: ping` comment lines; omitted or <= 0 disables the heartbeat
  readonly heartbeat?: number;
};

export type SseChannelOptions = SseOptions & {
  // tag each connecting client; `publish(topic, ...)` targets clients by this tag
  readonly topic?: (conn: Conn) => string | undefined;
};

export type SseClient = {
  readonly id: string;
  readonly topic?: string;
  // the Last-Event-ID header sent by a reconnecting EventSource, if any
  readonly lastEventId?: string;
  readonly send: (event: string, data: unknown, id?: SseId) => void;
  readonly close: () => void;
};

export type SseChannel = {
  readonly clients: () => SseClient[];
  readonly broadcast: (event: string, data: unknown, id?: SseId) => void;
  readonly publish: (topic: string, event: string, data: unknown, id?: SseId) => void;
  // A valid PipeFn, but declared synchronous so callers can use the result
  // without awaiting.
  readonly pipe: (conn: Conn) => Conn;
};

type Entry = {
  controller: ReadableStreamDefaultController;
  topic?: string;
  lastEventId?: string;
  timer?: ReturnType<typeof setInterval>;
};

const tooSlow = (ctrl: ReadableStreamDefaultController, msg: Uint8Array): boolean =>
  (ctrl.desiredSize ?? 0) < msg.byteLength;

export const createSseChannel = (options: SseChannelOptions = {}): SseChannel => {
  const store = new Map<string, Entry>();

  const drop = (id: string) => {
    const entry = store.get(id);
    if (entry?.timer) clearInterval(entry.timer);
    store.delete(id);
  };

  const push = (id: string, entry: Entry, msg: Uint8Array) => {
    try {
      if (tooSlow(entry.controller, msg)) {
        entry.controller.error(new Error("SSE client is too slow"));
        drop(id);
      } else entry.controller.enqueue(msg);
    } catch {
      drop(id);
    }
  };

  const makeClient = (id: string, entry: Entry): SseClient => ({
    id,
    topic: entry.topic,
    lastEventId: entry.lastEventId,
    send: (event, data, eid) => {
      if (store.has(id)) push(id, entry, frame(event, data, eid));
    },
    close: () => {
      try {
        entry.controller.close();
      } catch {
        /* already closed */
      }
      drop(id);
    },
  });

  const fanout = (match: (entry: Entry) => boolean, event: string, data: unknown, eid?: SseId) => {
    const msg = frame(event, data, eid);
    for (const [id, entry] of [...store]) if (match(entry)) push(id, entry, msg);
  };

  return {
    clients: () => [...store].map(([id, entry]) => makeClient(id, entry)),
    broadcast: (event, data, eid) => fanout(() => true, event, data, eid),
    publish: (topic, event, data, eid) => fanout((e) => e.topic === topic, event, data, eid),
    pipe: (conn) => {
      const id = crypto.randomUUID();
      const stream = new ReadableStream(
        {
          start(controller) {
            const entry: Entry = {
              controller,
              topic: options.topic?.(conn),
              lastEventId: conn.headers.get("last-event-id") ?? undefined,
            };
            store.set(id, entry);
            if (options.heartbeat && options.heartbeat > 0)
              entry.timer = setInterval(() => push(id, entry, ping), options.heartbeat);
            controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ id })}\n\n`));
          },
          cancel() {
            drop(id);
          },
        },
        new ByteLengthQueuingStrategy({ highWaterMark: MAX_QUEUE_BYTES }),
      );

      const headers = new Headers(conn.respHeaders);
      headers.set("content-type", "text/event-stream");
      headers.set("cache-control", "no-cache");
      headers.set("connection", "keep-alive");

      return {
        ...conn,
        status: 200,
        body: stream,
        respHeaders: headers,
        halted: true,
      };
    },
  };
};

export const eventStream = (
  conn: Conn,
  generator: (send: (event: string, data: unknown, id?: SseId) => void) => void | Promise<void>,
  options: SseOptions = {},
): Conn => {
  let cancelled = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
  };
  const stream = new ReadableStream<Uint8Array>(
    {
      async start(controller) {
        const send = (event: string, data: unknown, id?: SseId) => {
          if (cancelled) return;
          const msg = frame(event, data, id);
          if (tooSlow(controller, msg)) throw new Error("SSE client is too slow");
          controller.enqueue(msg);
        };
        if (options.heartbeat && options.heartbeat > 0)
          timer = setInterval(() => {
            try {
              if (!cancelled && !tooSlow(controller, ping)) controller.enqueue(ping);
            } catch {
              stop();
            }
          }, options.heartbeat);
        try {
          await generator(send);
          if (!cancelled) controller.close();
        } catch (err) {
          if (!cancelled) controller.error(err);
        } finally {
          stop();
        }
      },
      cancel() {
        cancelled = true;
        stop();
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark: MAX_QUEUE_BYTES }),
  );

  const headers = new Headers(conn.respHeaders);
  headers.set("content-type", "text/event-stream");
  headers.set("cache-control", "no-cache");
  headers.set("connection", "keep-alive");

  return { ...conn, status: 200, body: stream, respHeaders: headers, halted: true };
};
