import { expect, test } from "bun:test";
import { developmentCsp, productionCsp, withSecurityHeaders } from "../headers";

const okFetch = (_req: Request) => new Response("ok");

test("withSecurityHeaders sets default headers", async () => {
  const fetch = withSecurityHeaders(okFetch);
  const res = await fetch(new Request("http://localhost/"));
  expect(res.headers.get("strict-transport-security")).toContain("max-age=63072000");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("x-frame-options")).toBe("DENY");
  expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin");
  expect(res.headers.get("permissions-policy")).toContain("camera=()");
});

test("default CSP is the production one", async () => {
  const fetch = withSecurityHeaders(okFetch);
  const res = await fetch(new Request("http://localhost/"));
  expect(res.headers.get("content-security-policy")).toBe(productionCsp);
});

test("dev: true uses the development CSP", async () => {
  const fetch = withSecurityHeaders(okFetch, { dev: true });
  const res = await fetch(new Request("http://localhost/"));
  expect(res.headers.get("content-security-policy")).toBe(developmentCsp);
});

test("custom csp wins over dev/prod default", async () => {
  const fetch = withSecurityHeaders(okFetch, { csp: "default-src 'none'" });
  const res = await fetch(new Request("http://localhost/"));
  expect(res.headers.get("content-security-policy")).toBe("default-src 'none'");
});

test("disableCsp omits the CSP header", async () => {
  const fetch = withSecurityHeaders(okFetch, { disableCsp: true });
  const res = await fetch(new Request("http://localhost/"));
  expect(res.headers.get("content-security-policy")).toBeNull();
});

test("extra headers merge into the response", async () => {
  const fetch = withSecurityHeaders(okFetch, { headers: { "x-custom": "yes" } });
  const res = await fetch(new Request("http://localhost/"));
  expect(res.headers.get("x-custom")).toBe("yes");
});

test("existing headers on the response are not overwritten", async () => {
  const fetch = withSecurityHeaders((_req) => {
    const r = new Response("ok");
    r.headers.set("x-frame-options", "SAMEORIGIN");
    return r;
  });
  const res = await fetch(new Request("http://localhost/"));
  expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
});

test("Bun-style server.requestIP stashes peerIp on the request", async () => {
  let capturedPeer: string | undefined;
  const fetch = withSecurityHeaders((req) => {
    capturedPeer = (req as { peerIp?: string }).peerIp;
    return new Response("ok");
  });
  const req = new Request("http://localhost/");
  await fetch(req, { requestIP: () => ({ address: "203.0.113.7" }) });
  expect(capturedPeer).toBe("203.0.113.7");
});

test("missing requestIP leaves peerIp undefined", async () => {
  let capturedPeer: string | undefined;
  const fetch = withSecurityHeaders((req) => {
    capturedPeer = (req as { peerIp?: string }).peerIp;
    return new Response("ok");
  });
  await fetch(new Request("http://localhost/"));
  expect(capturedPeer).toBeUndefined();
});
