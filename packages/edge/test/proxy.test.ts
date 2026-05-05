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
