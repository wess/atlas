import type { Conn } from "../conn/index.ts";
import type { PipeFn } from "../pipe/index.ts";

export type SseClient = {
  readonly id: string;
  readonly send: (event: string, data: unknown) => void;
  readonly close: () => void;
};

export type SseChannel = {
  readonly clients: () => SseClient[];
  readonly broadcast: (event: string, data: unknown) => void;
  readonly pipe: PipeFn;
};

export const createSseChannel = (): SseChannel => {
  const store = new Map<string, { controller: ReadableStreamDefaultController }>();

  const makeClient = (id: string): SseClient => ({
    id,
    send: (event, data) => {
      const ctrl = store.get(id)?.controller;
      if (ctrl) {
        ctrl.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
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
      const msg = new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      for (const { controller } of store.values()) {
        try {
          controller.enqueue(msg);
        } catch {
          /* closed */
        }
      }
    },
    pipe: (conn) => {
      const id = crypto.randomUUID();
      const stream = new ReadableStream({
        start(controller) {
          store.set(id, { controller });
          controller.enqueue(new TextEncoder().encode(`event: connected\ndata: ${JSON.stringify({ id })}\n\n`));
        },
        cancel() {
          store.delete(id);
        },
      });

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
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      Promise.resolve(generator(send)).then(() => controller.close());
    },
  });

  const headers = new Headers(conn.respHeaders);
  headers.set("content-type", "text/event-stream");
  headers.set("cache-control", "no-cache");
  headers.set("connection", "keep-alive");

  return { ...conn, status: 200, body: stream, respHeaders: headers, halted: true };
};
