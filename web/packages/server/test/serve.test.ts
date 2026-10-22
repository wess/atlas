import { expect, test } from "bun:test";
import { clientIp, withSecurityHeaders } from "../../security/index.ts";
import { get, json, parseJson, pipeline, post, router, serve } from "../index.ts";

test("live server enforces body limits and returns 400 for malformed JSON", async () => {
  const server = serve({
    port: 0,
    hostname: "127.0.0.1",
    routes: [
      post(
        "/body",
        pipeline(parseJson)((c) => json(c, 200, c.body)),
      ),
    ],
  });
  try {
    expect(server.development).toBe(false);
    const malformed = await fetch(new URL("/body", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);
    const oversized = await fetch(new URL("/body", server.url), { method: "POST", body: "x".repeat(1024 * 1024 + 1) });
    expect(oversized.status).toBe(413);
  } finally {
    server.stop(true);
  }
});

test("security wrapper receives the socket peer through serve", async () => {
  const fetcher = withSecurityHeaders(router(get("/ip", (c) => json(c, 200, { ip: clientIp(c.request) }))));
  const server = serve({ port: 0, hostname: "127.0.0.1", routes: fetcher });
  try {
    const response = await fetch(new URL("/ip", server.url), { headers: { "x-forwarded-for": "1.1.1.1" } });
    expect((await response.json()).ip).toBe("127.0.0.1");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  } finally {
    server.stop(true);
  }
});
