import type { Conn } from "../conn/index.ts";
import { createConn } from "../conn/index.ts";
import type { PipeFn } from "../pipe/index.ts";
import type { WsConfig } from "../ws/index.ts";
import { ws as createWs } from "../ws/index.ts";

export type Route = {
  readonly method: string;
  readonly pattern: string;
  readonly handler: PipeFn;
};

export const get = (path: string, handler: PipeFn): Route => ({ method: "GET", pattern: path, handler });
export const post = (path: string, handler: PipeFn): Route => ({ method: "POST", pattern: path, handler });
export const put = (path: string, handler: PipeFn): Route => ({ method: "PUT", pattern: path, handler });
export const patch = (path: string, handler: PipeFn): Route => ({ method: "PATCH", pattern: path, handler });
export const del = (path: string, handler: PipeFn): Route => ({ method: "DELETE", pattern: path, handler });
export const head = (path: string, handler: PipeFn): Route => ({ method: "HEAD", pattern: path, handler });
export const options = (path: string, handler: PipeFn): Route => ({ method: "OPTIONS", pattern: path, handler });

const connToResponse = (conn: Conn): Response => {
  if (conn.body instanceof ReadableStream) {
    return new Response(conn.body, { status: conn.status, headers: conn.respHeaders });
  }
  if (typeof conn.body === "string") {
    return new Response(conn.body, { status: conn.status, headers: conn.respHeaders });
  }
  if (conn.body && typeof conn.body === "object" && !(conn.body instanceof Request)) {
    const headers = new Headers(conn.respHeaders);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return new Response(JSON.stringify(conn.body), { status: conn.status, headers });
  }
  return new Response(null, { status: conn.status, headers: conn.respHeaders });
};

const matchRoute = (pattern: string, path: string): Record<string, string> | null => {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  // Handle wildcard patterns (e.g. /admin/*)
  const lastPart = patternParts[patternParts.length - 1];
  if (lastPart === "*") {
    if (pathParts.length < patternParts.length - 1) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < patternParts.length - 1; i++) {
      const pp = patternParts[i]!;
      const val = pathParts[i]!;
      if (pp.startsWith(":")) {
        params[pp.slice(1)] = val;
      } else if (pp !== val) {
        return null;
      }
    }
    return params;
  }

  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    const val = pathParts[i]!;
    if (pp.startsWith(":")) {
      params[pp.slice(1)] = val;
    } else if (pp !== val) {
      return null;
    }
  }
  return params;
};

export const router = (...routes: Route[]) => {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    for (const route of routes) {
      if (req.method.toUpperCase() !== route.method) continue;
      const params = matchRoute(route.pattern, url.pathname);
      if (params === null) continue;
      try {
        const conn = createConn(req, params);
        const result = await route.handler(conn);
        return connToResponse(result);
      } catch (err) {
        console.error(`[atlas] Route error: ${req.method} ${url.pathname}`, err);
        return new Response(
          JSON.stringify({ error: "Internal Server Error", path: url.pathname, method: req.method }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }
    return new Response("Not Found", { status: 404 });
  };
};

type ServeOptions = {
  port?: number;
  hostname?: string;
  routes: Route[] | ((req: Request) => Promise<Response>);
  websocket?: WsConfig | any;
  development?: boolean;
};

export const serve = (options: ServeOptions) => {
  const fetch = typeof options.routes === "function" ? options.routes : router(...options.routes);

  if (
    options.websocket &&
    typeof options.websocket === "object" &&
    ("channels" in options.websocket ||
      "onOpen" in options.websocket ||
      "onMessage" in options.websocket ||
      "onClose" in options.websocket)
  ) {
    const { websocket, upgrade } = createWs(options.websocket as WsConfig);
    return Bun.serve({
      port: options.port ?? 3000,
      hostname: options.hostname ?? "0.0.0.0",
      fetch(req, server) {
        if (req.headers.get("upgrade") === "websocket") {
          if (upgrade(req, server)) return undefined as any;
        }
        return fetch(req);
      },
      websocket,
    });
  }

  return Bun.serve({
    port: options.port ?? 3000,
    hostname: options.hostname ?? "0.0.0.0",
    fetch,
    websocket: options.websocket,
  });
};
