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

test("concurrent transactions serialize and unrelated writes survive a rollback", async () => {
  const db = connectSqlite(":memory:");
  await db.execute({ text: "CREATE TABLE t (id INTEGER)", values: [] });
  let started!: () => void;
  let finish!: () => void;
  const active = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const failing = db.transaction(async (tx) => {
    await tx.execute({ text: "INSERT INTO t VALUES (?)", values: [1] });
    started();
    await gate;
    throw new Error("rollback");
  });
  await active;
  const outside = db.execute({ text: "INSERT INTO t VALUES (?)", values: [2] });
  const next = db.transaction(async (tx) => {
    await tx.execute({ text: "INSERT INTO t VALUES (?)", values: [3] });
  });
  finish();
  await expect(failing).rejects.toThrow("rollback");
  await Promise.all([outside, next]);
  expect(await db.all({ text: "SELECT id FROM t ORDER BY id", values: [] })).toEqual([{ id: 2 }, { id: 3 }]);
  await db.close();
});

test("execute returns CTE rows and cached statements survive schema changes", async () => {
  const db = connectSqlite(":memory:");
  expect(await db.execute({ text: "WITH n AS (SELECT 1 AS id) SELECT id FROM n", values: [] })).toEqual([{ id: 1 }]);
  await db.execute({ text: "CREATE TABLE t (id INTEGER)", values: [] });
  await db.all({ text: "SELECT * FROM t", values: [] });
  await db.execute({ text: "ALTER TABLE t ADD COLUMN name TEXT", values: [] });
  await db.execute({ text: "INSERT INTO t VALUES (1, 'one')", values: [] });
  expect(await db.all({ text: "SELECT * FROM t", values: [] })).toEqual([{ id: 1, name: "one" }]);
  await db.close();
});
