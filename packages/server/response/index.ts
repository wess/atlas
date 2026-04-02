import type { Conn } from "../conn/index.ts";

export const json = (conn: Conn, status: number, data: unknown): Conn => ({
  ...conn,
  status,
  body: data,
  halted: true,
  respHeaders: (() => {
    const h = new Headers(conn.respHeaders);
    h.set("content-type", "application/json");
    return h;
  })(),
});

export const text = (conn: Conn, status: number, body: string): Conn => ({
  ...conn,
  status,
  body,
  halted: true,
  respHeaders: (() => {
    const h = new Headers(conn.respHeaders);
    h.set("content-type", "text/plain");
    return h;
  })(),
});

export const redirect = (conn: Conn, location: string, status: number = 302): Conn => {
  const h = new Headers(conn.respHeaders);
  h.set("location", location);
  return { ...conn, status, halted: true, respHeaders: h };
};

export const stream = (conn: Conn, status: number, readable: ReadableStream): Conn => ({
  ...conn,
  status,
  body: readable,
  halted: true,
});
