import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "../../db/sqlite/index.ts";
import { createMigration, down, status, up } from "../../migrate/index.ts";
import { parseArgs } from "../command/index.ts";
import { migrateCommand } from "../migrate/index.ts";
import { type Deps, runMigrate } from "../migrate/run.ts";
import { checkName, parseTarget } from "../migrate/target.ts";

const realDeps = (lines: string[]): Deps => ({
  connect: async (t) => {
    if (t.driver !== "sqlite") throw new Error("test only runs sqlite");
    return connect({ path: t.path });
  },
  up,
  down,
  status,
  create: createMigration,
  log: (l) => lines.push(l),
});

test("parseTarget picks driver from DATABASE_URL", () => {
  expect(parseTarget("postgres://u:p@h/db")).toEqual({ driver: "postgres", url: "postgres://u:p@h/db" });
  expect(parseTarget("postgresql://h/db").driver).toBe("postgres");
  expect(parseTarget("./app.db")).toEqual({ driver: "sqlite", path: "./app.db" });
  expect(parseTarget("sqlite:./app.db")).toEqual({ driver: "sqlite", path: "./app.db" });
  expect(parseTarget(":memory:")).toEqual({ driver: "sqlite", path: ":memory:" });
});

test("parseTarget fails clearly without DATABASE_URL", () => {
  expect(() => parseTarget(undefined)).toThrow("DATABASE_URL is not set");
  expect(() => parseTarget("  ")).toThrow("DATABASE_URL is not set");
});

test("checkName validates migration names", () => {
  expect(checkName("add_users")).toBe("add_users");
  expect(() => checkName(undefined)).toThrow("Usage");
  expect(() => checkName("bad name")).toThrow("Invalid migration name");
  expect(() => checkName("../x")).toThrow("Invalid migration name");
});

test("migrate command declares --dir with ./migrations default", () => {
  expect(migrateCommand.name).toBe("migrate");
  const parsed = parseArgs(["up"], migrateCommand.flags ?? {});
  expect(parsed.args).toEqual(["up"]);
  expect(parsed.flags.dir).toBe("./migrations");
  expect(parseArgs(["up", "-d", "db/m"], migrateCommand.flags ?? {}).flags.dir).toBe("db/m");
});

test("runMigrate rejects missing and unknown actions", async () => {
  const deps = realDeps([]);
  await expect(runMigrate([], { dir: "m" }, deps)).rejects.toThrow("Usage: atlas migrate");
  await expect(runMigrate(["sideways"], { dir: "m" }, deps)).rejects.toThrow('Unknown migrate action "sideways"');
  await expect(runMigrate(["up"], { dir: "m" }, deps)).rejects.toThrow("DATABASE_URL is not set");
});

test("new creates a migration folder in the dir", async () => {
  const root = mkdtempSync(join(tmpdir(), "atlasmigrate-"));
  const dir = join(root, "migrations");
  const lines: string[] = [];
  await runMigrate(["new", "add_users"], { dir }, realDeps(lines));
  const made = readdirSync(dir);
  expect(made).toHaveLength(1);
  expect(made[0]).toMatch(/^\d{14}_add_users$/);
  expect(readdirSync(join(dir, made[0]!)).sort()).toEqual(["down.sql", "up.sql"]);
  expect(lines[0]).toContain("add_users");
});

test("up, status and down run against a sqlite file", async () => {
  const root = mkdtempSync(join(tmpdir(), "atlasmigrate-"));
  const dir = join(root, "migrations");
  const url = join(root, "app.db");
  const lines: string[] = [];
  const deps = realDeps(lines);
  await runMigrate(["new", "add_things"], { dir }, deps);
  const name = readdirSync(dir)[0]!;
  await Bun.write(join(dir, name, "up.sql"), "create table things (id integer primary key);");
  await Bun.write(join(dir, name, "down.sql"), "drop table things;");

  await runMigrate(["status"], { dir, url }, deps);
  expect(lines.at(-1)).toBe(`pending  ${name}`);
  await runMigrate(["up"], { dir, url }, deps);
  expect(lines.at(-1)).toBe(`✔ applied ${name}`);
  await runMigrate(["up"], { dir, url }, deps);
  expect(lines.at(-1)).toBe("→ nothing to apply");
  await runMigrate(["status"], { dir, url }, deps);
  expect(lines.at(-1)).toBe(`applied  ${name}`);
  await runMigrate(["down"], { dir, url }, deps);
  expect(lines.at(-1)).toBe(`✔ rolled back ${name}`);
  await runMigrate(["down"], { dir, url }, deps);
  expect(lines.at(-1)).toBe("→ nothing to roll back");
});

test("DATABASE_URL schemes are case-insensitive, and unknown ones are refused instead of opened as files", async () => {
  const { parseTarget } = await import("../migrate/target.ts");
  expect(parseTarget("POSTGRES://u@h/db")).toEqual({ driver: "postgres", url: "POSTGRES://u@h/db" });
  expect(parseTarget("SQLite:./app.db")).toEqual({ driver: "sqlite", path: "./app.db" });
  expect(() => parseTarget("mysql://u:p@h/db")).toThrow("Unsupported DATABASE_URL scheme");
});

test("creating a migration never overwrites one that exists", async () => {
  const { createMigration } = await import("../../migrate/files/index.ts");
  const { mkdtempSync, readFileSync, rmSync, writeFileSync } = await import("node:fs");
  const dir = mkdtempSync(`${(await import("node:os")).tmpdir()}/atlasmigratenew`);
  const first = createMigration(dir, "add_x");
  expect(first.name).toMatch(/^\d{14}_add_x$/);
  writeFileSync(first.upPath, "CREATE TABLE x (id INTEGER);");
  expect(() => createMigration(dir, "add_x")).toThrow("already exists");
  expect(readFileSync(first.upPath, "utf-8")).toBe("CREATE TABLE x (id INTEGER);");
  rmSync(dir, { recursive: true, force: true });
});
