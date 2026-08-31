import type { Conn, ConnLike } from "../conn/index.ts";

const withContentType = (headers: Headers, value: string): Headers => {
  const h = new Headers(headers);
  h.set("content-type", value);
  return h;
};

export const json = (conn: ConnLike, status: number, data: unknown): Conn =>
  ({
    ...conn,
    status,
    body: data,
    halted: true,
    respHeaders: withContentType(conn.respHeaders, "application/json"),
  }) as Conn;

export const text = (conn: ConnLike, status: number, body: string): Conn =>
  ({
    ...conn,
    status,
    body,
    halted: true,
    respHeaders: withContentType(conn.respHeaders, "text/plain"),
  }) as Conn;

export const redirect = (conn: ConnLike, location: string, status: number = 302): Conn => {
  const h = new Headers(conn.respHeaders);
  h.set("location", location);
  return { ...conn, status, halted: true, respHeaders: h } as Conn;
};

export const stream = (conn: ConnLike, status: number, readable: ReadableStream): Conn =>
  ({
    ...conn,
    status,
    body: readable,
    halted: true,
  }) as Conn;
