import { afterAll, beforeAll, expect, test } from "bun:test";
import type { ForwardContext } from "../proxy/index.ts";
import { forward } from "../proxy/index.ts";

let upstream: ReturnType<typeof Bun.serve>;
let upstreamUrl: string;
const seen: Array<{ method: string; path: string; headers: Record<string, string> }> = [];

beforeAll(() => {
  upstream = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => {
        headers[k] = v;
      });
      seen.push({ method: req.method, path: url.pathname + url.search, headers });
      if (url.pathname === "/encoded") {
        const headers = new Headers({ "content-encoding": "gzip" });
        headers.append("set-cookie", "session=one; HttpOnly; Path=/");
        headers.append("set-cookie", "other=two; Path=/");
        return new Response(Bun.gzipSync("encoded body"), { headers });
      }
      return new Response(JSON.stringify({ ok: true, path: url.pathname }), {
        headers: { "content-type": "application/json" },
      });
    },
  });
  upstreamUrl = `http://127.0.0.1:${upstream.port}`;
});

afterAll(() => {
  upstream.stop(true);
});

test("forward preserves method, path, query", async () => {
  seen.length = 0;
  const ctx: ForwardContext = { remoteIp: "9.9.9.9", tls: true, host: "edge.example.com" };
  const req = new Request("https://edge.example.com/api/users?id=42", { method: "POST", body: "hi" });
  const res = await forward(req, { upstream: upstreamUrl }, ctx);
  expect(res.status).toBe(200);
  const recv = seen[0]!;
  expect(recv.method).toBe("POST");
  expect(recv.path).toBe("/api/users?id=42");
});

test("forward injects X-Real-IP, X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host", async () => {
  seen.length = 0;
  const ctx: ForwardContext = { remoteIp: "9.9.9.9", tls: true, host: "edge.example.com" };
  const req = new Request("https://edge.example.com/", { headers: { "x-forwarded-for": "1.1.1.1" } });
  await forward(req, { upstream: upstreamUrl }, ctx);
  const recv = seen[0]!;
  expect(recv.headers["x-real-ip"]).toBe("9.9.9.9");
  expect(recv.headers["x-forwarded-for"]).toBe("1.1.1.1, 9.9.9.9");
  expect(recv.headers["x-forwarded-proto"]).toBe("https");
  expect(recv.headers["x-forwarded-host"]).toBe("edge.example.com");
});

test("forward rewrites Host to upstream by default", async () => {
  seen.length = 0;
  const ctx: ForwardContext = { remoteIp: "9.9.9.9", tls: true, host: "edge.example.com" };
  const req = new Request("https://edge.example.com/");
  await forward(req, { upstream: upstreamUrl }, ctx);
  const recv = seen[0]!;
  expect(recv.headers.host).toBe(new URL(upstreamUrl).host);
});

test("forward keeps original Host when preserveHost=true", async () => {
  seen.length = 0;
  const ctx: ForwardContext = { remoteIp: "9.9.9.9", tls: true, host: "edge.example.com" };
  const req = new Request("https://edge.example.com/", { headers: { host: "edge.example.com" } });
  await forward(req, { upstream: upstreamUrl, preserveHost: true }, ctx);
  const recv = seen[0]!;
  expect(recv.headers.host).toBe("edge.example.com");
});

test("forward strips client-supplied hop-by-hop values", async () => {
  seen.length = 0;
  const ctx: ForwardContext = { remoteIp: "9.9.9.9", tls: false, host: "h" };
  // Caller tries to inject "connection: close" — must not survive the proxy.
  // (fetch will set its own connection header; we only assert the malicious
  // value is gone.)
  const req = new Request("http://h/", { headers: { connection: "close" } });
  await forward(req, { upstream: upstreamUrl }, ctx);
  const recv = seen[0]!;
  expect(recv.headers.connection).not.toBe("close");
});

test("double-slash request paths cannot replace the configured upstream origin", async () => {
  seen.length = 0;
  const ctx: ForwardContext = { remoteIp: "9.9.9.9", tls: false, host: "edge" };
  await forward(new Request("http://edge//127.0.0.1:1/private?q=1"), { upstream: upstreamUrl }, ctx);
  expect(seen).toHaveLength(1);
  expect(seen[0]?.headers.host).toBe(new URL(upstreamUrl).host);
});

test("Connection-nominated request headers and Trailer are stripped", async () => {
  seen.length = 0;
  await forward(
    new Request("http://edge/", { headers: { connection: "x-private", "x-private": "secret", trailer: "x-secret" } }),
    { upstream: upstreamUrl },
    { remoteIp: "1.2.3.4", tls: false, host: "edge" },
  );
  expect(seen[0]?.headers["x-private"]).toBeUndefined();
  expect(seen[0]?.headers.trailer).toBeUndefined();
});

test("encoded upstream bodies and multiple cookies survive forwarding", async () => {
  const response = await forward(
    new Request("http://edge/encoded"),
    { upstream: upstreamUrl },
    { remoteIp: "1.2.3.4", tls: false, host: "edge" },
  );
  expect(response.headers.get("content-encoding")).toBe("gzip");
  expect(new TextDecoder().decode(Bun.gunzipSync(await response.bytes()))).toBe("encoded body");
  expect(response.headers.getSetCookie()).toHaveLength(2);
});
