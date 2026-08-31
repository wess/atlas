import { expect, test } from "bun:test";
import { connectSqlite } from "../drivers/sqlite.ts";
import { from } from "../from/index.ts";

test("sqlite driver can execute queries", async () => {
  const db = connectSqlite(":memory:");
  await db.execute({ text: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)", values: [] });
  await db.execute({ text: "INSERT INTO users (name) VALUES (?)", values: ["Wess"] });
  const rows = await db.all(from("users").select("name"));
  expect(rows).toEqual([{ name: "Wess" }]);
  await db.close();
});

test("sqlite driver one() returns single row", async () => {
  const db = connectSqlite(":memory:");
  await db.execute({ text: "CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)", values: [] });
  await db.execute({ text: "INSERT INTO t (v) VALUES (?)", values: ["a"] });
  const row = await db.one({ text: "SELECT v FROM t WHERE id = ?", values: [1] });
  expect(row).toEqual({ v: "a" });
  await db.close();
});

test("sqlite driver one() returns null on empty", async () => {
  const db = connectSqlite(":memory:");
  await db.execute({ text: "CREATE TABLE t (id INTEGER PRIMARY KEY)", values: [] });
  const row = await db.one({ text: "SELECT * FROM t WHERE id = ?", values: [999] });
  expect(row).toBeNull();
  await db.close();
});

test("sqlite driver transaction", async () => {
  const db = connectSqlite(":memory:");
  await db.execute({ text: "CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)", values: [] });
  await db.transaction(async (tx) => {
    await tx.execute({ text: "INSERT INTO t (v) VALUES (?)", values: ["a"] });
    await tx.execute({ text: "INSERT INTO t (v) VALUES (?)", values: ["b"] });
  });
  const rows = await db.all({ text: "SELECT v FROM t ORDER BY v", values: [] });
  expect(rows).toEqual([{ v: "a" }, { v: "b" }]);
  await db.close();
});

test("sqlite driver works with query builder chains", async () => {
  const db = connectSqlite(":memory:");
  await db.execute({ text: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)", values: [] });
  await db.execute(from("users").insert({ name: "Wess", email: "wess@test.com" }));
  const user = await db.one(from("users").where((q) => q("name").equals("Wess")));
  expect(user).toEqual({ id: 1, name: "Wess", email: "wess@test.com" });
  await db.close();
});
