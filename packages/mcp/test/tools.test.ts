import { expect, test } from "bun:test";
import { createMemoryCache } from "../../cache/index.ts";
import { connect } from "../../db/index.ts";
import { createContext } from "../context/index.ts";
import { collectTools, defineTool } from "../tools/index.ts";

test("defineTool creates a tool", () => {
  const tool = defineTool({
    name: "test.tool",
    description: "A test tool",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({ ok: true }),
  });
  expect(tool.name).toBe("test.tool");
});

test("collectTools returns db tools when db present", () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  const ctx = createContext({ db });
  const tools = collectTools(ctx);
  expect(tools.some((t) => t.name === "db.query")).toBe(true);
  expect(tools.some((t) => t.name === "db.schemas")).toBe(true);
});

test("collectTools excludes db tools when no db", () => {
  const ctx = createContext();
  const tools = collectTools(ctx);
  expect(tools.some((t) => t.name === "db.query")).toBe(false);
});

test("collectTools returns cache tools when cache present", () => {
  const cache = createMemoryCache();
  const ctx = createContext({ cache });
  const tools = collectTools(ctx);
  expect(tools.some((t) => t.name === "cache.get")).toBe(true);
  expect(tools.some((t) => t.name === "cache.flush")).toBe(true);
});

test("collectTools always includes health", () => {
  const ctx = createContext();
  const tools = collectTools(ctx);
  expect(tools.some((t) => t.name === "health.check")).toBe(true);
});

test("collectTools includes routes when present", () => {
  const ctx = createContext({ routes: [{ method: "GET", pattern: "/", handler: async (c: any) => c }] });
  const tools = collectTools(ctx);
  expect(tools.some((t) => t.name === "routes.list")).toBe(true);
});

test("collectTools includes migrate tools when db and migrationsDir present", () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  const ctx = createContext({ db, migrationsDir: "./migrations" });
  const tools = collectTools(ctx);
  expect(tools.some((t) => t.name === "migrate.status")).toBe(true);
  expect(tools.some((t) => t.name === "migrate.up")).toBe(true);
  expect(tools.some((t) => t.name === "migrate.down")).toBe(true);
});

test("collectTools excludes migrate tools when no migrationsDir", () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  const ctx = createContext({ db, migrationsDir: undefined });
  const tools = collectTools(ctx);
  expect(tools.some((t) => t.name === "migrate.status")).toBe(false);
});

test("db.query tool executes SQL", async () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  await db.execute({ text: "CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)", values: [] });
  await db.execute({ text: "INSERT INTO t (v) VALUES (?)", values: ["hello"] });
  const ctx = createContext({ db });
  const tools = collectTools(ctx);
  const queryTool = tools.find((t) => t.name === "db.query")!;
  const result = (await queryTool.handler({ sql: "SELECT * FROM t", params: "[]" }, ctx)) as any;
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0].v).toBe("hello");
});

test("db.schemas tool lists tables", async () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  await db.execute({ text: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)", values: [] });
  const ctx = createContext({ db });
  const tools = collectTools(ctx);
  const schemaTool = tools.find((t) => t.name === "db.schemas")!;
  const result = (await schemaTool.handler({}, ctx)) as any;
  expect(result.users).toBeDefined();
  expect(result.users.length).toBeGreaterThan(0);
});

test("config.show redacts secrets", async () => {
  const ctx = createContext({
    config: { database: { url: "postgres://localhost", password: "secret123" }, port: 3000 },
  });
  const tools = collectTools(ctx);
  const configTool = tools.find((t) => t.name === "config.show")!;
  const result = (await configTool.handler({}, ctx)) as any;
  expect(result.port).toBe(3000);
  expect(result.database.password).toBe("***REDACTED***");
  expect(result.database.url).toBe("postgres://localhost");
});

test("health.check runs against db", async () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  const ctx = createContext({ db });
  const tools = collectTools(ctx);
  const healthTool = tools.find((t) => t.name === "health.check")!;
  const result = (await healthTool.handler({}, ctx)) as any;
  expect(result.database).toBe("ok");
});

test("cache tools work with memory cache", async () => {
  const cache = createMemoryCache();
  const ctx = createContext({ cache });
  const tools = collectTools(ctx);

  const setTool = tools.find((t) => t.name === "cache.set")!;
  await setTool.handler({ key: "test", value: JSON.stringify({ hello: "world" }) }, ctx);

  const getTool = tools.find((t) => t.name === "cache.get")!;
  const result = (await getTool.handler({ key: "test" }, ctx)) as any;
  expect(result.value).toEqual({ hello: "world" });

  const delTool = tools.find((t) => t.name === "cache.del")!;
  await delTool.handler({ key: "test" }, ctx);

  const after = (await getTool.handler({ key: "test" }, ctx)) as any;
  expect(after.value).toBeNull();
});

test("routes.list returns route info", async () => {
  const ctx = createContext({
    routes: [
      { method: "GET", pattern: "/api/users", handler: async (c: any) => c },
      { method: "POST", pattern: "/api/users", handler: async (c: any) => c },
    ],
  });
  const tools = collectTools(ctx);
  const routesTool = tools.find((t) => t.name === "routes.list")!;
  const result = (await routesTool.handler({}, ctx)) as any[];
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({ method: "GET", pattern: "/api/users" });
});

test("logs.tail returns recent lines", async () => {
  const ctx = createContext({ logBuffer: ["a", "b", "c", "d", "e"] });
  const tools = collectTools(ctx);
  const logTool = tools.find((t) => t.name === "logs.tail")!;
  const result = (await logTool.handler({ lines: 3 }, ctx)) as any;
  expect(result.lines).toEqual(["c", "d", "e"]);
  expect(result.count).toBe(3);
});

test("logs.tail defaults to 50 lines", async () => {
  const ctx = createContext({ logBuffer: ["a", "b"] });
  const tools = collectTools(ctx);
  const logTool = tools.find((t) => t.name === "logs.tail")!;
  const result = (await logTool.handler({}, ctx)) as any;
  expect(result.lines).toEqual(["a", "b"]);
  expect(result.count).toBe(2);
});
