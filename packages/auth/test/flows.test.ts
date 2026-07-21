import { expect, test } from "bun:test";
import { column, connect, defineSchema } from "../../db/index.ts";
import { createConn, json } from "../../server/index.ts";
import { requireAuth, signup } from "../flows/index.ts";
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

test("signup accepts a defineSchema table", async () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  await db.execute({
    text: "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL)",
    values: [],
  });
  const users = defineSchema("users", {
    id: column.serial().primaryKey(),
    email: column.text().unique(),
    password: column.text(),
  });

  const pipe = signup({
    db,
    table: users,
    fields: ["email", "password"],
    onSuccess: (c) => json(c, 201, { ok: true }),
  });
  const req = new Request("http://localhost/signup", { method: "POST" });
  const conn = { ...createConn(req), body: { email: "a@b.c", password: "secret" } };
  const result = await pipe(conn);
  expect(result.status).toBe(201);

  const row = await db.one<{ email: string }>({ text: "SELECT email FROM users", values: [] });
  expect(row?.email).toBe("a@b.c");
  await db.close();
});
