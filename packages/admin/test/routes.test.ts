import { beforeEach, expect, test } from "bun:test";
import type { Connection } from "@atlas/db";
import { column, connect, defineSchema } from "@atlas/db";
import { router } from "@atlas/server";
import { admin, model } from "../config/index.ts";

const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text(),
  name: column.text(),
});

const posts = defineSchema("posts", {
  id: column.serial().primaryKey(),
  title: column.text(),
  userid: column.integer(),
});

let db: Connection;
let app: (req: Request) => Promise<Response>;

beforeEach(async () => {
  db = connect({ driver: "sqlite", path: ":memory:" });
  await db.execute({
    text: "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, name TEXT)",
    values: [],
  });
  await db.execute({
    text: "CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, userid INTEGER)",
    values: [],
  });
  await db.execute({ text: "INSERT INTO users (email, name) VALUES (?, ?)", values: ["wess@test.com", "Wess"] });
  await db.execute({ text: "INSERT INTO posts (title, userid) VALUES (?, ?)", values: ["Hello", 1] });

  const adm = admin({
    db,
    models: [
      model({
        schema: users,
        searchFields: ["email", "name"],
        filterFields: ["name"],
        relations: [{ schema: posts, foreignKey: "userid" }],
      }),
      model({ schema: posts, readOnly: true }),
    ],
  });
  app = router(adm.routes);
});

test("GET /admin/api/schema returns model metadata", async () => {
  const res = await app(new Request("http://localhost/admin/api/schema"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.models).toHaveLength(2);
  expect(body.models[0].table).toBe("users");
  expect(body.models[1].table).toBe("posts");
  expect(body.models[1].readOnly).toBe(true);
});

test("GET /admin/api/users lists records", async () => {
  const res = await app(new Request("http://localhost/admin/api/users"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(1);
  expect(body.data[0].email).toBe("wess@test.com");
  expect(body.meta.page).toBe(1);
  expect(body.meta.total).toBe(1);
});

test("GET /admin/api/users supports pagination", async () => {
  await db.execute({ text: "INSERT INTO users (email, name) VALUES (?, ?)", values: ["a@test.com", "A"] });
  await db.execute({ text: "INSERT INTO users (email, name) VALUES (?, ?)", values: ["b@test.com", "B"] });

  const res = await app(new Request("http://localhost/admin/api/users?page=2&limit=1"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(1);
  expect(body.meta.page).toBe(2);
  expect(body.meta.pages).toBe(3);
});

test("GET /admin/api/users supports search", async () => {
  await db.execute({ text: "INSERT INTO users (email, name) VALUES (?, ?)", values: ["other@test.com", "Other"] });

  const res = await app(new Request("http://localhost/admin/api/users?search=wess"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(1);
  expect(body.data[0].name).toBe("Wess");
});

test("GET /admin/api/users supports filters", async () => {
  await db.execute({ text: "INSERT INTO users (email, name) VALUES (?, ?)", values: ["other@test.com", "Other"] });

  const res = await app(new Request("http://localhost/admin/api/users?filter.name=Wess"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(1);
  expect(body.data[0].name).toBe("Wess");
});

test("GET /admin/api/users supports sorting", async () => {
  await db.execute({ text: "INSERT INTO users (email, name) VALUES (?, ?)", values: ["a@test.com", "Alpha"] });

  const res = await app(new Request("http://localhost/admin/api/users?sort=name&order=desc"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data[0].name).toBe("Wess");
  expect(body.data[1].name).toBe("Alpha");
});

test("GET /admin/api/users/:id gets one", async () => {
  const res = await app(new Request("http://localhost/admin/api/users/1"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data.name).toBe("Wess");
});

test("GET /admin/api/users/:id returns 404 for missing", async () => {
  const res = await app(new Request("http://localhost/admin/api/users/999"));
  expect(res.status).toBe(404);
});

test("POST /admin/api/users creates record", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new@test.com", name: "New" }),
    }),
  );
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.data.email).toBe("new@test.com");
});

test("PUT /admin/api/users/:id updates record", async () => {
  const res = await app(
    new Request("http://localhost/admin/api/users/1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data.name).toBe("Updated");
});

test("DELETE /admin/api/users/:id deletes record", async () => {
  const res = await app(new Request("http://localhost/admin/api/users/1", { method: "DELETE" }));
  expect(res.status).toBe(200);
  const list = await app(new Request("http://localhost/admin/api/users"));
  const body = await list.json();
  expect(body.data).toHaveLength(0);
});

test("readOnly model does not generate write routes", async () => {
  const create = await app(
    new Request("http://localhost/admin/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "New", userid: 1 }),
    }),
  );
  expect(create.status).toBe(404);

  const del = await app(new Request("http://localhost/admin/api/posts/1", { method: "DELETE" }));
  expect(del.status).toBe(404);
});

test("GET relations returns related records", async () => {
  const res = await app(new Request("http://localhost/admin/api/users/1/relations/posts"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toHaveLength(1);
  expect(body.data[0].title).toBe("Hello");
});
