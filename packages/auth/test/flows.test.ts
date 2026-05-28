import { expect, test } from "bun:test";
import { createConn } from "../../server/index.ts";
import { requireAuth } from "../flows/index.ts";
import * as token from "../token/index.ts";

test("requireAuth adds auth to assigns", async () => {
  const jwt = await token.sign({ userId: 1 }, "test-secret");
  const req = new Request("http://localhost/", {
    headers: { authorization: `Bearer ${jwt}` },
  });
  const conn = createConn(req);
  const authPipe = requireAuth({ secret: "test-secret" });
  const result = await authPipe(conn);
  expect(result.assigns.auth).toBeDefined();
  expect((result.assigns.auth as any).userId).toBe(1);
});

test("requireAuth halts 401 without token", async () => {
  const req = new Request("http://localhost/");
  const conn = createConn(req);
  const authPipe = requireAuth({ secret: "test-secret" });
  const result = await authPipe(conn);
  expect(result.halted).toBe(true);
  expect(result.status).toBe(401);
});

test("requireAuth halts 401 with invalid token", async () => {
  const req = new Request("http://localhost/", {
    headers: { authorization: "Bearer invalid.token.here" },
  });
  const conn = createConn(req);
  const authPipe = requireAuth({ secret: "test-secret" });
  const result = await authPipe(conn);
  expect(result.halted).toBe(true);
  expect(result.status).toBe(401);
});

test("requireAuth halts 401 with expired token", async () => {
  const jwt = await token.sign({ userId: 1 }, "test-secret", { expiresIn: -1 });
  const req = new Request("http://localhost/", {
    headers: { authorization: `Bearer ${jwt}` },
  });
  const conn = createConn(req);
  const authPipe = requireAuth({ secret: "test-secret" });
  const result = await authPipe(conn);
  expect(result.halted).toBe(true);
  expect(result.status).toBe(401);
});

test("requireAuth halts 401 with non-Bearer auth", async () => {
  const req = new Request("http://localhost/", {
    headers: { authorization: "Basic abc123" },
  });
  const conn = createConn(req);
  const authPipe = requireAuth({ secret: "test-secret" });
  const result = await authPipe(conn);
  expect(result.halted).toBe(true);
  expect(result.status).toBe(401);
});
