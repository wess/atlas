import type { Notifier, NotifyMessage } from "./notify";

export type NotifyServerOptions = {
  readonly notifier: Notifier;
  readonly token: string;
  readonly port?: number;
  readonly hostname?: string;
  readonly maxBodyBytes?: number;
};

export type NotifyServer = {
  readonly hostname: string;
  readonly port: number;
  readonly url: URL;
  readonly stop: () => Promise<void>;
};

const json = (value: unknown, status = 200): Response =>
  Response.json(value, { status, headers: { "cache-control": "no-store" } });

export const serveNotify = (options: NotifyServerOptions): NotifyServer => {
  const token = options.token.trim();
  if (!token) throw new Error("Notify service requires a non-empty bearer token");
  const maxBodyBytes = options.maxBodyBytes ?? 256 * 1024;
  const server = Bun.serve({
    hostname: options.hostname ?? "127.0.0.1",
    port: options.port ?? 0,
    fetch: async (request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/health") return json({ ok: true });
      if (request.method !== "POST" || url.pathname !== "/notify") return json({ error: "Not found" }, 404);
      if (request.headers.get("authorization") !== `Bearer ${token}`) {
        return json({ error: "Unauthorized" }, 401);
      }
      const length = Number(request.headers.get("content-length") ?? 0);
      if (length > maxBodyBytes) return json({ error: "Request body is too large" }, 413);
      const text = await request.text();
      if (Buffer.byteLength(text) > maxBodyBytes) return json({ error: "Request body is too large" }, 413);
      try {
        const message = JSON.parse(text) as NotifyMessage;
        const result = await options.notifier.send(message);
        return json(result, result.ok ? 202 : 502);
      } catch {
        return json({ error: "Invalid notification payload" }, 400);
      }
    },
  });

  return {
    hostname: server.hostname ?? options.hostname ?? "127.0.0.1",
    port: server.port ?? options.port ?? 0,
    url: server.url,
    stop: () => server.stop(true),
  };
};
