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
};

const buildChannelMap = (channels: Channel[]): Map<string, Channel> => {
  const map = new Map<string, Channel>();
  for (const ch of channels) map.set(ch.name, ch);
  return map;
};

export const ws = (config: WsConfig) => {
  const rooms = createRooms();
  const channelMap = config.channels ? buildChannelMap(config.channels) : new Map<string, Channel>();

  const websocket = {
    open: (raw: any) => {
      const conn = wrapRaw(raw);
      config.onOpen?.(conn);
    },
    message: (raw: any, message: string | Buffer) => {
      const conn = wrapRaw(raw);

      if (typeof message === "string" && channelMap.size > 0) {
        try {
          const parsed = JSON.parse(message);
          if (parsed && typeof parsed.channel === "string") {
            const ch = channelMap.get(parsed.channel);
            if (ch) {
              if (parsed.event === "join" && ch.join) {
                Promise.resolve(ch.join(conn, parsed.payload ?? {}));
                return;
              }
              if (parsed.event === "leave" && ch.leave) {
                ch.leave(conn);
                return;
              }
              if (ch.handle) {
                Promise.resolve(ch.handle(conn, parsed.event ?? "message", parsed.payload));
                return;
              }
            }
          }
        } catch {
          // not JSON, fall through to raw handler
        }
      }

      config.onMessage?.(conn, message);
    },
    close: (raw: any, code: number, reason: string) => {
      const conn = wrapRaw(raw);
      config.onClose?.(conn, code, reason);
      // Drop dead sockets from every room; nothing else runs after close.
      rooms.leaveAll(conn);
    },
  };

  const upgrade = (req: Request, server: any, data?: unknown): boolean => server.upgrade(req, { data });

  return { websocket, rooms, upgrade };
};

export const wsAdapter = createAdapter<WsConfig>("ws", (config) => {
  const { websocket, upgrade } = ws(config);

  const server = Bun.serve({
    port: config.port ?? 3001,
    hostname: config.hostname ?? "0.0.0.0",
    fetch(req, server) {
      if (upgrade(req, server)) return undefined as any;
      return new Response("Upgrade Required", { status: 426 });
    },
    websocket,
  });

  return { stop: () => server.stop() };
});
