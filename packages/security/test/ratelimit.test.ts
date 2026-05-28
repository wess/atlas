import { expect, test } from "bun:test";
import { connect } from "../../db/index.ts";
import { clientIp, createDbRateLimit, createMemoryRateLimit, parseTrustedProxies, userAgent } from "../ratelimit";

const reqWith = (headers: Record<string, string>, peerIp?: string): Request => {
  const r = new Request("http://localhost/", { headers });
  if (peerIp) (r as { peerIp?: string }).peerIp = peerIp;
  return r;
};

test("memory limiter allows up to max", async () => {
  const lim = createMemoryRateLimit();
  const r1 = await lim.check("k", 3, 60);
  const r2 = await lim.check("k", 3, 60);
  const r3 = await lim.check("k", 3, 60);
  expect(r1.ok).toBe(true);
  expect(r2.ok).toBe(true);
  expect(r3.ok).toBe(true);
});

test("memory limiter blocks after max", async () => {
  const lim = createMemoryRateLimit();
  await lim.check("k", 2, 60);
  await lim.check("k", 2, 60);
  const blocked = await lim.check("k", 2, 60);
  expect(blocked.ok).toBe(false);
  expect(blocked.count).toBe(3);
  expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
});

test("memory limiter resets after the window", async () => {
  const lim = createMemoryRateLimit();
  // Window of 0 seconds means every check is a fresh window.
  expect((await lim.check("k", 1, 0)).ok).toBe(true);
  expect((await lim.check("k", 1, 0)).ok).toBe(true);
});

test("memory limiter buckets are independent", async () => {
  const lim = createMemoryRateLimit();
  await lim.check("a", 1, 60);
  await lim.check("a", 1, 60); // a is now blocked
  expect((await lim.check("b", 1, 60)).ok).toBe(true);
});

test("memory limiter reset clears a bucket", async () => {
  const lim = createMemoryRateLimit();
  await lim.check("k", 1, 60);
  await lim.check("k", 1, 60);
  await lim.reset("k");
  expect((await lim.check("k", 1, 60)).ok).toBe(true);
});

test("DB-backed (sqlite) limiter allows then blocks", async () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  await db.execute({
    text: "CREATE TABLE rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, window_started_at INTEGER NOT NULL)",
    values: [],
  });
  const lim = createDbRateLimit({ db });
  expect((await lim.check("k", 2, 60)).ok).toBe(true);
  expect((await lim.check("k", 2, 60)).ok).toBe(true);
  const blocked = await lim.check("k", 2, 60);
  expect(blocked.ok).toBe(false);
  expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  await db.close();
});

test("clientIp returns peer when no trusted proxies configured", () => {
  const req = reqWith({ "x-forwarded-for": "1.2.3.4" }, "10.0.0.1");
  expect(clientIp(req)).toBe("10.0.0.1");
});

test("clientIp ignores X-Forwarded-For from untrusted peers", () => {
  const trusted = parseTrustedProxies("172.16.0.0/12");
  const req = reqWith({ "x-forwarded-for": "1.2.3.4" }, "10.0.0.1");
  expect(clientIp(req, { trustedProxies: trusted })).toBe("10.0.0.1");
});

test("clientIp honors X-Forwarded-For when peer is a trusted proxy", () => {
  const trusted = parseTrustedProxies("10.0.0.0/8");
  const req = reqWith({ "x-forwarded-for": "203.0.113.7, 10.0.0.99" }, "10.0.0.99");
  expect(clientIp(req, { trustedProxies: trusted })).toBe("203.0.113.7");
});

test("clientIp falls back to X-Real-IP when XFF is absent", () => {
  const trusted = parseTrustedProxies("10.0.0.0/8");
  const req = reqWith({ "x-real-ip": "203.0.113.7" }, "10.0.0.99");
  expect(clientIp(req, { trustedProxies: trusted })).toBe("203.0.113.7");
});

test("clientIp returns 'unknown' when peerIp is missing", () => {
  const req = new Request("http://localhost/");
  expect(clientIp(req)).toBe("unknown");
});

test("parseTrustedProxies skips garbage entries", () => {
  const cidrs = parseTrustedProxies("10.0.0.0/8, garbage, 192.168.1.1, 999.0.0.1, 10.0.0.0/40");
  // valid: 10.0.0.0/8 and 192.168.1.1 — the rest are dropped
  expect(cidrs).toHaveLength(2);
});

test("parseTrustedProxies handles null / empty", () => {
  expect(parseTrustedProxies(null)).toHaveLength(0);
  expect(parseTrustedProxies("")).toHaveLength(0);
  expect(parseTrustedProxies(undefined)).toHaveLength(0);
});

test("userAgent caps the header at 256 characters", () => {
  const ua = "Mozilla/5.0 ".repeat(50);
  const req = new Request("http://localhost/", { headers: { "user-agent": ua } });
  expect(userAgent(req).length).toBe(256);
});

test("userAgent returns empty string when missing", () => {
  expect(userAgent(new Request("http://localhost/"))).toBe("");
});
