import { createAdapter } from "../adapter/index.ts";

export type WsConn<T = unknown> = {
  readonly raw: any;
  readonly data: T;
  readonly send: (msg: string | object) => void;
  readonly close: (code?: number, reason?: string) => void;
  readonly subscribe: (channel: string) => void;
  readonly unsubscribe: (channel: string) => void;
};

export type WsHandler<T = unknown> = {
  readonly open?: (ws: WsConn<T>) => void;
  readonly message?: (ws: WsConn<T>, data: string | Buffer) => void;
  readonly close?: (ws: WsConn<T>, code: number, reason: string) => void;
};

export type Channel<T = unknown> = {
  readonly name: string;
  readonly join?: (ws: WsConn<T>, params: Record<string, unknown>) => boolean | Promise<boolean>;
  readonly leave?: (ws: WsConn<T>) => void;
  readonly handle?: (ws: WsConn<T>, event: string, payload: unknown) => void | Promise<void>;
};

export const channel = <T = unknown>(name: string, handlers: Omit<Channel<T>, "name">): Channel<T> => ({
  name,
  ...handlers,
});

export type RoomManager = {
  readonly join: (ws: WsConn, room: string) => void;
  readonly leave: (ws: WsConn, room: string) => void;
  /** Remove a connection from every room it joined. Called on disconnect. */
  readonly leaveAll: (ws: WsConn) => void;
  readonly broadcast: (room: string, msg: string | object, exclude?: WsConn) => void;
  readonly members: (room: string) => Set<WsConn>;
};

export const createRooms = (): RoomManager => {
  const rooms = new Map<string, Set<WsConn>>();
  const joined = new Map<WsConn, Set<string>>();

  const leave = (ws: WsConn, room: string): void => {
    const members = rooms.get(room);
    if (members) {
      members.delete(ws);
      if (members.size === 0) rooms.delete(room);
    }
    const set = joined.get(ws);
    if (set) {
      set.delete(room);
      if (set.size === 0) joined.delete(ws);
    }
    try {
      ws.unsubscribe(room);
    } catch {
      // socket may already be closed
    }
  };

  return {
    join: (ws, room) => {
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room)!.add(ws);
      if (!joined.has(ws)) joined.set(ws, new Set());
      joined.get(ws)!.add(room);
      ws.subscribe(room);
    },
    leave,
    leaveAll: (ws) => {
      const set = joined.get(ws);
      if (!set) return;
      for (const room of [...set]) leave(ws, room);
    },
    broadcast: (room, msg, exclude) => {
      const payload = typeof msg === "object" ? JSON.stringify(msg) : msg;
      const members = rooms.get(room);
      if (!members) return;
      for (const ws of members) {
        if (ws !== exclude) ws.send(payload);
      }
    },
    members: (room) => rooms.get(room) ?? new Set(),
  };
};

// One stable wrapper per raw socket. Handlers receive the same WsConn across
// open/message/close, so identity-based bookkeeping (room sets, broadcast
// exclude) works; a fresh wrapper per event would never match.
const wrappers = new WeakMap<object, WsConn<unknown>>();

const wrapRaw = <T>(raw: any): WsConn<T> => {
  const cached = wrappers.get(raw);
  if (cached) return cached as WsConn<T>;
  const conn: WsConn<T> = {
    raw,
    data: raw.data as T,
    send: (msg) => {
      const payload = typeof msg === "object" ? JSON.stringify(msg) : msg;
      raw.send(payload);
    },
    close: (code, reason) => raw.close(code, reason),
    subscribe: (ch) => raw.subscribe(ch),
    unsubscribe: (ch) => raw.unsubscribe(ch),
  };
  wrappers.set(raw, conn as WsConn<unknown>);
  return conn;
};

export type WsConfig = {
  port?: number;
  hostname?: string;
  channels?: Channel[];
  onOpen?: WsHandler["open"];
  onMessage?: WsHandler["message"];
  onClose?: WsHandler["close"];
  /** Build `ws.data` from the upgrade request (cookies, headers, a verified session). */
  upgradeData?: (req: Request) => unknown | Promise<unknown>;
  /** Called when a handler throws or rejects. The socket is then closed with 1011. Defaults to console.error. */
  onError?: (error: unknown, ws: WsConn) => void;
};

const buildChannelMap = (channels: Channel[]): Map<string, Channel> => {
  const map = new Map<string, Channel>();
  for (const ch of channels) map.set(ch.name, ch);
  return map;
};

export const ws = (config: WsConfig) => {
  const rooms = createRooms();
  const channelMap = config.channels ? buildChannelMap(config.channels) : new Map<string, Channel>();
  // Channels each socket has been admitted to. A channel with a `join` hook
  // only dispatches `handle` after join resolved true for that socket.
  const admitted = new WeakMap<WsConn, Set<string>>();

  const fail = (conn: WsConn, error: unknown): void => {
    try {
      if (config.onError) config.onError(error, conn);
      else console.error("[atlas/ws] handler failed:", error);
    } catch (reportError) {
      console.error("[atlas/ws] onError failed:", reportError);
    }
    try {
      conn.close(1011, "internal error");
    } catch {
      // already closed
    }
  };

  // Handlers may be sync or async; either way a throw must not escape as an
  // unhandled rejection, which takes the whole Bun process down.
  const run = <R>(conn: WsConn, fn: () => R | Promise<R>, then?: (value: R) => void): void => {
    try {
      const result = fn();
      if (result instanceof Promise) {
        result.then(
          (value) => then?.(value),
          (error) => fail(conn, error),
        );
        return;
      }
      then?.(result);
    } catch (error) {
      fail(conn, error);
    }
  };

  const admit = (conn: WsConn, name: string): void => {
    const set = admitted.get(conn) ?? new Set<string>();
    admitted.set(conn, new Set([...set, name]));
  };

  const dismiss = (conn: WsConn, name: string): void => {
    const set = admitted.get(conn);
    if (set) admitted.set(conn, new Set([...set].filter((n) => n !== name)));
  };

  const parseFrame = (message: string): { channel: string; event?: unknown; payload?: unknown } | null => {
    try {
      const parsed = JSON.parse(message);
      return parsed && typeof parsed === "object" && typeof parsed.channel === "string" ? parsed : null;
    } catch {
      return null;
    }
  };

  const websocket = {
    open: (raw: any) => {
      const conn = wrapRaw(raw);
      run(conn, () => config.onOpen?.(conn));
    },
    message: (raw: any, message: string | Buffer) => {
      const conn = wrapRaw(raw);

      if (typeof message === "string" && channelMap.size > 0) {
        const frame = parseFrame(message);
        const ch = frame ? channelMap.get(frame.channel) : undefined;
        if (frame && ch) {
          const event = typeof frame.event === "string" ? frame.event : "message";
          if (event === "join" && ch.join) {
            const join = ch.join;
            const params = (frame.payload ?? {}) as Record<string, unknown>;
            run(
              conn,
              () => join(conn, params),
              (ok) => {
                if (ok === true) admit(conn, ch.name);
              },
            );
            return;
          }
          if (event === "leave" && ch.leave) {
            const leave = ch.leave;
            dismiss(conn, ch.name);
            run(conn, () => leave(conn));
            return;
          }
          if (ch.handle) {
            // Channels without a join hook stay open to every socket, as before.
            if (ch.join && !admitted.get(conn)?.has(ch.name)) return;
            const handle = ch.handle;
            run(conn, () => handle(conn, event, frame.payload));
            return;
          }
        }
      }

      run(conn, () => config.onMessage?.(conn, message));
    },
    close: (raw: any, code: number, reason: string) => {
      const conn = wrapRaw(raw);
      try {
        config.onClose?.(conn, code, reason);
      } catch (error) {
        console.error("[atlas/ws] onClose failed:", error);
      }
      admitted.delete(conn);
      // Drop dead sockets from every room; nothing else runs after close.
      rooms.leaveAll(conn);
    },
  };

  const upgrade = (req: Request, server: any, data?: unknown): boolean => server.upgrade(req, { data });

  // Like `upgrade`, but fills `ws.data` from `config.upgradeData(req)` when no
  // explicit data is passed.
  const upgradeFrom = async (req: Request, server: any): Promise<boolean> => {
    const data = config.upgradeData ? await config.upgradeData(req) : undefined;
    return server.upgrade(req, { data });
  };

  return { websocket, rooms, upgrade, upgradeFrom };
};

export const wsAdapter = createAdapter<WsConfig>("ws", (config) => {
  const { websocket, upgradeFrom } = ws(config);

  const server = Bun.serve({
    port: config.port ?? 3001,
    hostname: config.hostname ?? "0.0.0.0",
    async fetch(req, server) {
      if (await upgradeFrom(req, server)) return undefined as any;
      return new Response("Upgrade Required", { status: 426 });
    },
    websocket,
  });

  return { stop: () => server.stop() };
});
