import { beforeEach, expect, test } from "bun:test";
import type { Connection } from "../../db/index.ts";
import { column, connect, defineSchema } from "../../db/index.ts";
import { router } from "../../server/index.ts";
import { admin, model } from "../config/index.ts";

const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text(),
  name: column.text(),
});

let db: Connection;
let app: (req: Request) => Promise<Response>;

beforeEach(async () => {
  db = connect({ driver: "sqlite", path: ":memory:" });
  await db.execute({
    text: "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, name TEXT)",
    values: [],
  });
  await db.execute({ text: "INSERT INTO users (email, name) VALUES (?, ?)", values: ["a@test.com", "A"] });
  await db.execute({ text: "INSERT INTO users (email, name) VALUES (?, ?)", values: ["b@test.com", "B"] });
  await db.execute({ text: "INSERT INTO users (email, name) VALUES (?, ?)", values: ["c@test.com", "C"] });

  const adm = admin({
    db,
    models: [
      model({
        schema: users,
        bulkActions: ["delete", "export"],
        actions: [
          {
            name: "deactivate",
            label: "Deactivate Users",
            handler: async (_db, ids) => ({ message: `Deactivated ${ids.length} users` }),
          },
        ],
      }),
    ],
  });
  app = router(...adm.routes);
});

test("POST /admin/api/users/bulk delete removes records", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/users/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: [1, 2] }),
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.message).toContain("2");

  const list = await app(new Request("http://localhost/admin/api/users"));
  const listBody = await list.json();
  expect(listBody.data).toHaveLength(1);
  expect(listBody.data[0].name).toBe("C");
});

test("POST /admin/api/users/bulk export returns records", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/users/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "export", ids: [1, 3] }),
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(2);
  expect(body.format).toBe("export");
});

test("POST /admin/api/users/bulk rejects unknown action", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/users/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "archive", ids: [1] }),
    }),
  );
  expect(res.status).toBe(400);
});

test("POST /admin/api/users/action runs custom action", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/users/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "deactivate", ids: [1, 2] }),
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.message).toBe("Deactivated 2 users");
});

test("POST /admin/api/users/action rejects unknown action", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/users/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "nonexistent", ids: [1] }),
    }),
  );
  expect(res.status).toBe(400);
});
