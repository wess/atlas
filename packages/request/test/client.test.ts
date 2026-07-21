import { afterAll, beforeAll, expect, test } from "bun:test";
import { createClient, request } from "../client/index.ts";

// Shape of the /echo endpoint's JSON payload (see fetch handler below).
type EchoBody = { method: string; path: string; headers: Record<string, string> };

let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/echo") {
        return new Response(
          JSON.stringify({
            method: req.method,
            headers: Object.fromEntries(req.headers.entries()),
            path: url.pathname,
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      if (url.pathname === "/json" && req.method === "POST") {
        return req.json().then(
          (body) =>
            new Response(JSON.stringify(body), {
              headers: { "content-type": "application/json" },
            }),
        );
      }
      if (url.pathname === "/slow") {
        return new Promise((resolve) => setTimeout(() => resolve(new Response("late")), 300));
      }
      return new Response("Not Found", { status: 404 });
    },
  });
});

afterAll(() => {
  server.stop();
});

test("request makes a GET", async () => {
  const res = await request(`http://localhost:${server.port}/echo`);
  const body = (await res.json()) as EchoBody;
  expect(body.method).toBe("GET");
});

test("request sends JSON body", async () => {
  const res = await request(`http://localhost:${server.port}/json`, {
    method: "POST",
    json: { hello: "world" },
  });
  const body = await res.json();
  expect(body).toEqual({ hello: "world" });
});

test("createClient prepends baseUrl", async () => {
  const client = createClient({ baseUrl: `http://localhost:${server.port}` });
  const res = await client.get("/echo");
  const body = (await res.json()) as EchoBody;
  expect(body.method).toBe("GET");
  expect(body.path).toBe("/echo");
});

test("createClient merges headers", async () => {
  const client = createClient({
    baseUrl: `http://localhost:${server.port}`,
    headers: { "x-custom": "test" },
  });
  const res = await client.get("/echo");
  const body = (await res.json()) as EchoBody;
  expect(body.headers["x-custom"]).toBe("test");
});

test("createClient post with json", async () => {
  const client = createClient({ baseUrl: `http://localhost:${server.port}` });
  const res = await client.post("/json", { json: { name: "Wess" } });
  const body = await res.json();
  expect(body).toEqual({ name: "Wess" });
});

test("timeout aborts a slow request", async () => {
  await expect(request(`http://localhost:${server.port}/slow`, { timeout: 50 })).rejects.toThrow();
});

test("timeout allows a fast request through", async () => {
  const res = await request(`http://localhost:${server.port}/echo`, { timeout: 5000 });
  expect(res.status).toBe(200);
});

test("client-level timeout applies and per-request overrides it", async () => {
  const client = createClient({ baseUrl: `http://localhost:${server.port}`, timeout: 50 });
  await expect(client.get("/slow")).rejects.toThrow();
  const res = await client.get("/slow", { timeout: 5000 });
  expect(res.status).toBe(200);
});
