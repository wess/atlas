import type { Conn } from "../conn/index.ts";

const encoder = new TextEncoder();
const MAX_QUEUE_BYTES = 256 * 1024;
const frame = (event: string, data: unknown): Uint8Array => {
  if (/[\r\n]/.test(event)) throw new Error("Invalid SSE event name");
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

export type SseClient = {
  readonly id: string;
  readonly send: (event: string, data: unknown) => void;
  readonly close: () => void;
};

export type SseChannel = {
  readonly clients: () => SseClient[];
  readonly broadcast: (event: string, data: unknown) => void;
  // A valid PipeFn, but declared synchronous so callers can use the result
  // without awaiting.
  readonly pipe: (conn: Conn) => Conn;
};

export const createSseChannel = (): SseChannel => {
  const store = new Map<string, { controller: ReadableStreamDefaultController }>();

  const makeClient = (id: string): SseClient => ({
    id,
    send: (event, data) => {
      const ctrl = store.get(id)?.controller;
      if (ctrl) {
        const msg = frame(event, data);
        if ((ctrl.desiredSize ?? 0) < msg.byteLength) {
          ctrl.error(new Error("SSE client is too slow"));
          store.delete(id);
          return;
        }
        ctrl.enqueue(msg);
      }
    },
    close: () => {
      const ctrl = store.get(id)?.controller;
      if (ctrl) {
        try {
          ctrl.close();
        } catch {
          /* already closed */
        }
      }
      store.delete(id);
    },
  });

  return {
    clients: () => [...store.keys()].map(makeClient),
    broadcast: (event, data) => {
      const msg = frame(event, data);
      for (const [id, { controller }] of store) {
        try {
          if ((controller.desiredSize ?? 0) < msg.byteLength) {
            controller.error(new Error("SSE client is too slow"));
            store.delete(id);
          } else controller.enqueue(msg);
        } catch {
          store.delete(id);
        }
      }
    },
    pipe: (conn) => {
      const id = crypto.randomUUID();
      const stream = new ReadableStream(
        {
          start(controller) {
            store.set(id, { controller });
            controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ id })}\n\n`));
          },
          cancel() {
            store.delete(id);
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
  generator: (send: (event: string, data: unknown) => void) => void | Promise<void>,
): Conn => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      async start(controller) {
        const send = (event: string, data: unknown) => {
          if (cancelled) return;
          const msg = frame(event, data);
          if ((controller.desiredSize ?? 0) < msg.byteLength) throw new Error("SSE client is too slow");
          controller.enqueue(msg);
        };
        try {
          await generator(send);
          if (!cancelled) controller.close();
        } catch (err) {
          if (!cancelled) controller.error(err);
        }
      },
      cancel() {
        cancelled = true;
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
