import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "../../db/index.ts";
import { down, ensureTable, status, up } from "../migrations/index.ts";

const testDir = "/tmp/atlas_migrate_ops_test";
let db: any;

beforeEach(async () => {
  db = connect({ driver: "sqlite", path: ":memory:" });
  mkdirSync(`${testDir}/20260401_create_users`, { recursive: true });
  writeFileSync(`${testDir}/20260401_create_users/up.sql`, "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);");
  writeFileSync(`${testDir}/20260401_create_users/down.sql`, "DROP TABLE users;");
  mkdirSync(`${testDir}/20260402_create_posts`, { recursive: true });
  writeFileSync(`${testDir}/20260402_create_posts/up.sql`, "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT);");
  writeFileSync(`${testDir}/20260402_create_posts/down.sql`, "DROP TABLE posts;");
});

afterEach(async () => {
  await db.close();
  rmSync(testDir, { recursive: true, force: true });
});

test("ensureTable creates schema_migrations table", async () => {
  await ensureTable(db);
  const tables = await db.all({
    text: "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'",
    values: [],
  });
  expect(tables).toHaveLength(1);
});

test("up runs pending migrations", async () => {
  const ran = await up(db, testDir);
  expect(ran).toEqual(["20260401_create_users", "20260402_create_posts"]);
  const users = await db.all({
    text: "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
    values: [],
  });
  expect(users).toHaveLength(1);
});

test("up skips already applied", async () => {
  await up(db, testDir);
  const ran = await up(db, testDir);
  expect(ran).toEqual([]);
});

test("down rolls back last migration", async () => {
  await up(db, testDir);
  const rolled = await down(db, testDir);
  expect(rolled).toBe("20260402_create_posts");
  const tables = await db.all({
    text: "SELECT name FROM sqlite_master WHERE type='table' AND name='posts'",
    values: [],
  });
  expect(tables).toHaveLength(0);
});

test("down returns null when nothing to roll back", async () => {
  const rolled = await down(db, testDir);
  expect(rolled).toBeNull();
});

test("status shows applied and pending", async () => {
  await up(db, testDir);
  await down(db, testDir);
  const s = await status(db, testDir);
  expect(s).toHaveLength(2);
  expect(s[0]!.appliedAt).not.toBeNull();
  expect(s[1]!.appliedAt).toBeNull();
});
