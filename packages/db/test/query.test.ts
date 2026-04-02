import { expect, test } from "bun:test";
import { from } from "../from/index.ts";

test("basic select", () => {
  const { text, values } = from("users").select("id", "email").toSql();
  expect(text).toBe("SELECT id, email FROM users");
  expect(values).toEqual([]);
});

test("select with where", () => {
  const { text, values } = from("users")
    .where((q) => q("email").equals("test@test.com"))
    .toSql();
  expect(text).toBe("SELECT * FROM users WHERE email = $1");
  expect(values).toEqual(["test@test.com"]);
});

test("select with multiple wheres", () => {
  const { text, values } = from("users")
    .where((q) => q("active").equals(true))
    .where((q) => q("role").equals("admin"))
    .toSql();
  expect(text).toBe("SELECT * FROM users WHERE active = $1 AND role = $2");
  expect(values).toEqual([true, "admin"]);
});

test("select with order and limit", () => {
  const { text, values } = from("users").orderBy("created_at", "DESC").limit(10).offset(20).toSql();
  expect(text).toBe("SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2");
  expect(values).toEqual([10, 20]);
});

test("insert", () => {
  const { text, values } = from("users").insert({ email: "test@test.com", name: "Test" }).toSql();
  expect(text).toBe("INSERT INTO users (email, name) VALUES ($1, $2)");
  expect(values).toEqual(["test@test.com", "Test"]);
});

test("insert with returning", () => {
  const { text, values } = from("users").insert({ email: "test@test.com" }).returning("id", "email").toSql();
  expect(text).toBe("INSERT INTO users (email) VALUES ($1) RETURNING id, email");
  expect(values).toEqual(["test@test.com"]);
});

test("update with where", () => {
  const { text, values } = from("users")
    .update({ name: "Updated" })
    .where((q) => q("id").equals(1))
    .toSql();
  expect(text).toBe("UPDATE users SET name = $1 WHERE id = $2");
  expect(values).toEqual(["Updated", 1]);
});

test("delete with where", () => {
  const { text, values } = from("users")
    .del()
    .where((q) => q("id").equals(1))
    .toSql();
  expect(text).toBe("DELETE FROM users WHERE id = $1");
  expect(values).toEqual([1]);
});

test("join", () => {
  const { text } = from("users")
    .leftJoin("posts", "posts.user_id = users.id")
    .select("users.id", "posts.title")
    .toSql();
  expect(text).toBe("SELECT users.id, posts.title FROM users LEFT JOIN posts ON posts.user_id = users.id");
});

test("or where", () => {
  const { text, values } = from("users")
    .where((q) => q.or(q("role").equals("admin"), q("role").equals("super")))
    .toSql();
  expect(text).toBe("SELECT * FROM users WHERE (role = $1 OR role = $2)");
  expect(values).toEqual(["admin", "super"]);
});
