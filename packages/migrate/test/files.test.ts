import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createMigration, scanMigrations } from "../files/index.ts";

const testDir = "/tmp/atlas_migrate_test";

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

test("createMigration scaffolds folder with up.sql and down.sql", async () => {
  const m = createMigration(testDir, "add_users");
  expect(m.name).toMatch(/^\d{8}_add_users$/);
  // Bun.write is async, await the files
  await Bun.write(`${testDir}/${m.name}/up.sql`, "");
  await Bun.write(`${testDir}/${m.name}/down.sql`, "");
  expect(Bun.file(m.upPath).size).toBe(0);
  expect(Bun.file(m.downPath).size).toBe(0);
});

test("scanMigrations returns sorted list", () => {
  mkdirSync(`${testDir}/20260401_first`, { recursive: true });
  writeFileSync(`${testDir}/20260401_first/up.sql`, "CREATE TABLE a (id INT);");
  writeFileSync(`${testDir}/20260401_first/down.sql`, "DROP TABLE a;");
  mkdirSync(`${testDir}/20260402_second`, { recursive: true });
  writeFileSync(`${testDir}/20260402_second/up.sql`, "CREATE TABLE b (id INT);");
  writeFileSync(`${testDir}/20260402_second/down.sql`, "DROP TABLE b;");

  const migrations = scanMigrations(testDir);
  expect(migrations).toHaveLength(2);
  expect(migrations[0]!.name).toBe("20260401_first");
  expect(migrations[1]!.name).toBe("20260402_second");
});

test("scanMigrations returns empty for nonexistent dir", () => {
  const migrations = scanMigrations("/tmp/atlas_nonexistent_dir");
  expect(migrations).toHaveLength(0);
});

test("scanMigrations skips dirs without both sql files", () => {
  mkdirSync(`${testDir}/20260401_incomplete`, { recursive: true });
  writeFileSync(`${testDir}/20260401_incomplete/up.sql`, "CREATE TABLE a (id INT);");
  // no down.sql

  const migrations = scanMigrations(testDir);
  expect(migrations).toHaveLength(0);
});
