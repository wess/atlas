import type { Conn } from "../conn/index.ts";
import { createConn } from "../conn/index.ts";
import type { PipeFn } from "../pipe/index.ts";
import type { WsConfig } from "../ws/index.ts";
import { ws as createWs } from "../ws/index.ts";

type RouteMap = Record<string, PipeFn>;

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

const parseRoute = (route: string): { method: string; pattern: string } => {
  const spaceIdx = route.indexOf(" ");
  return {
    method: route.slice(0, spaceIdx).toUpperCase(),
    pattern: route.slice(spaceIdx + 1),
  };
};

const matchRoute = (pattern: string, path: string): Record<string, string> | null => {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");
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

export const router = (routes: RouteMap) => {
  const entries = Object.entries(routes).map(([route, handler]) => ({
    ...parseRoute(route),
    handler,
  }));

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    for (const { method, pattern, handler } of entries) {
      if (req.method.toUpperCase() !== method) continue;
      const params = matchRoute(pattern, url.pathname);
      if (params === null) continue;
      try {
        const conn = createConn(req, params);
        const result = await handler(conn);
        return connToResponse(result);
      } catch (err) {
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response("Not Found", { status: 404 });
  };
};

type ServeOptions = {
  port?: number;
  hostname?: string;
  routes: RouteMap | ((req: Request) => Promise<Response>);
  websocket?: WsConfig | any;
};

export const serve = (options: ServeOptions) => {
  const handler = typeof options.routes === "function" ? options.routes : router(options.routes);

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
        return handler(req);
      },
      websocket,
    });
  }

  return Bun.serve({
    port: options.port ?? 3000,
    hostname: options.hostname ?? "0.0.0.0",
    fetch: handler,
    websocket: options.websocket,
  });
};
