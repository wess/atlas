import { beforeEach, expect, test } from "bun:test";
import type { Connection } from "@atlas/db";
import { column, connect, defineSchema } from "@atlas/db";
import { router } from "@atlas/server";
import { admin, model } from "../config/index.ts";

const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text(),
  name: column.text(),
  age: column.integer(),
});

let db: Connection;
let app: (req: Request) => Promise<Response>;

beforeEach(async () => {
  db = connect({ driver: "sqlite", path: ":memory:" });
  await db.execute({
    text: "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, name TEXT, age INTEGER)",
    values: [],
  });
  await db.execute({
    text: "INSERT INTO users (email, name, age) VALUES (?, ?, ?)",
    values: ["wess@test.com", "Wess", 30],
  });
  await db.execute({
    text: "INSERT INTO users (email, name, age) VALUES (?, ?, ?)",
    values: ["other@test.com", "Other", 25],
  });

  const adm = admin({ db, models: [model({ schema: users })] });
  app = router(...adm.routes);
});

test("POST /admin/api/query executes query with filters", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        table: "users",
        filters: [{ field: "age", op: "gt", value: 26 }],
      }),
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(1);
  expect(body.data[0].name).toBe("Wess");
  expect(body.sql).toContain("users");
});

test("POST /admin/api/query supports select and sort", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        table: "users",
        select: ["name", "age"],
        sort: { field: "age", direction: "asc" },
      }),
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(2);
  expect(body.data[0].name).toBe("Other");
  expect(body.data[1].name).toBe("Wess");
});

test("POST /admin/api/query supports limit and offset", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        table: "users",
        sort: { field: "id", direction: "asc" },
        limit: 1,
        offset: 1,
      }),
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(1);
  expect(body.data[0].name).toBe("Other");
});

test("POST /admin/api/query rejects unknown table", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ table: "nonexistent" }),
    }),
  );
  expect(res.status).toBe(400);
});

test("POST /admin/api/query/preview returns SQL without executing", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/query/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        table: "users",
        select: ["name", "email"],
        filters: [{ field: "age", op: "gte", value: 18 }],
        sort: { field: "name", direction: "asc" },
        limit: 10,
      }),
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.sql).toBeDefined();
  expect(body.params).toBeDefined();
  expect(body.sql).toContain("users");
});

test("POST /admin/api/query supports eq filter", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        table: "users",
        filters: [{ field: "name", op: "eq", value: "Wess" }],
      }),
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(1);
  expect(body.data[0].name).toBe("Wess");
});
