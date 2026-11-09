import { expect, test } from "bun:test";
import { connectPostgres } from "../../db/postgres/index.ts";
import { connectSqlite } from "../../db/sqlite/index.ts";
import { createContext } from "../context/index.ts";
import { isReadStatement } from "../tools/db.ts";
import { collectTools } from "../tools/index.ts";

const queryTool = (ctx: ReturnType<typeof createContext>) => collectTools(ctx).find((t) => t.name === "db.query")!;

test("isReadStatement looks past comments and parens", () => {
  expect(isReadStatement("select 1")).toBe(true);
  expect(isReadStatement("  -- hi\n/* x */ (SELECT 1)")).toBe(true);
  expect(isReadStatement("WITH x AS (SELECT 1) SELECT * FROM x")).toBe(true);
  expect(isReadStatement("EXPLAIN SELECT 1")).toBe(true);
  expect(isReadStatement("delete from users")).toBe(false);
  expect(isReadStatement("/* select */ drop table users")).toBe(false);
  expect(isReadStatement("")).toBe(false);
});

test("sqlite: db.query refuses writes by default", async () => {
  const db = connectSqlite(":memory:");
  await db.execute({ text: "create table users (id integer, name text)", values: [] });
  await db.execute({ text: "insert into users values (1, 'a')", values: [] });
  const ctx = createContext({ db });
  const tool = queryTool(ctx);

  await expect(tool.handler({ sql: "delete from users" }, ctx)).rejects.toThrow(/read-only/);
  await expect(tool.handler({ sql: "drop table users" }, ctx)).rejects.toThrow(/read-only/);
  // a CTE can carry DML; the engine refuses it under query_only
  await expect(
    tool.handler({ sql: "with x as (select 1) insert into users select 2, 'b' from x" }, ctx),
  ).rejects.toThrow();
  // stacked statement after a select never runs
  await tool.handler({ sql: "select 1; delete from users" }, ctx).catch(() => {});

  const result = (await tool.handler({ sql: "select * from users" }, ctx)) as { count: number };
  expect(result.count).toBe(1);
  // query_only is lifted afterwards so the app keeps working
  await db.execute({ text: "insert into users values (3, 'c')", values: [] });
  await db.close();
});

test("sqlite: allowWrites opts back in", async () => {
  const db = connectSqlite(":memory:");
  await db.execute({ text: "create table users (id integer)", values: [] });
  const ctx = createContext({ db, allowWrites: true });
  await queryTool(ctx).handler({ sql: "insert into users values (1)" }, ctx);
  expect(await db.all({ text: "select * from users", values: [] })).toEqual([{ id: 1 }]);
  await db.close();
});

test("write tools carry destructive annotations", () => {
  const ctx = createContext({ db: connectSqlite(":memory:"), migrationsDir: "./migrations" });
  const tools = collectTools(ctx);
  const up = tools.find((t) => t.name === "migrate.up")!;
  expect(up.annotations?.destructiveHint).toBe(true);
  expect(up.description.startsWith("WRITES:")).toBe(true);
  expect(tools.find((t) => t.name === "db.query")!.annotations?.readOnlyHint).toBe(true);
});

// needs a real server: ATLAS_TEST_POSTGRES_URL=postgres://user:pass@host:port/db
const url = process.env.ATLAS_TEST_POSTGRES_URL;

test.skipIf(!url)("postgres: db.query runs in a read-only transaction and can't stack out of it", async () => {
  const db = connectPostgres(url!, 1);
  try {
    await db.execute({ text: "drop table if exists atlas_mcpro; create table atlas_mcpro (v int)", values: [] });
    const ctx = createContext({ db });
    const tool = queryTool(ctx);
    await expect(
      tool.handler({ sql: "with x as (insert into atlas_mcpro values (1) returning v) select * from x" }, ctx),
    ).rejects.toThrow(/read-only/);
    await expect(tool.handler({ sql: "select 1; commit; insert into atlas_mcpro values (2)" }, ctx)).rejects.toThrow();
    const rows = await db.all<{ n: number }>({ text: "select count(*)::int as n from atlas_mcpro", values: [] });
    expect(rows[0]!.n).toBe(0);
    const ok = (await tool.handler({ sql: "select $1::int as v", params: "[5]" }, ctx)) as { rows: unknown[] };
    expect(ok.rows).toEqual([{ v: 5 }]);
  } finally {
    await db.execute({ text: "drop table if exists atlas_mcpro", values: [] });
    await db.close();
  }
});
