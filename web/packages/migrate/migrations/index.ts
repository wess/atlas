import type { Connection } from "../../db/query.ts";
import { readSql, scanMigrations } from "../files/index.ts";
import { splitSqlite } from "./statements.ts";

// postgres runs a parameterless multi-statement string as one implicit transaction. sqlite would
// run only the first statement, so it gets each one in turn inside an explicit transaction.
const runScript = async (db: Connection, sql: string, record: { text: string; values: unknown[] }) => {
  if (db.dialect === "postgres") {
    await db.execute({ text: sql, values: [] });
    await db.execute(record);
    return;
  }
  await db.transaction(async (tx) => {
    for (const statement of splitSqlite(sql)) await tx.execute({ text: statement, values: [] });
    await tx.execute(record);
  });
};

export type MigrationStatus = {
  readonly name: string;
  readonly appliedAt: Date | null;
};

export const ensureTable = async (db: Connection): Promise<void> => {
  await db.execute({
    text: `CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    values: [],
  });
};

const getApplied = async (db: Connection): Promise<Set<string>> => {
  const rows = await db.all({
    text: "SELECT name FROM schema_migrations ORDER BY name",
    values: [],
  });
  return new Set(rows.map((r: any) => r.name));
};

export const up = async (db: Connection, dir: string = "./migrations"): Promise<string[]> => {
  await ensureTable(db);
  const applied = await getApplied(db);
  const files = scanMigrations(dir);
  const pending = files.filter((f) => !applied.has(f.name));
  const ran: string[] = [];

  for (const migration of pending) {
    await runScript(db, readSql(migration.upPath), {
      text:
        db.dialect === "postgres"
          ? "INSERT INTO schema_migrations (name) VALUES ($1)"
          : "INSERT INTO schema_migrations (name) VALUES (?)",
      values: [migration.name],
    });
    ran.push(migration.name);
  }

  return ran;
};

export const down = async (db: Connection, dir: string = "./migrations"): Promise<string | null> => {
  await ensureTable(db);
  const applied = await getApplied(db);
  const files = scanMigrations(dir).reverse();
  const lastApplied = files.find((f) => applied.has(f.name));

  if (!lastApplied) return null;

  await runScript(db, readSql(lastApplied.downPath), {
    text:
      db.dialect === "postgres"
        ? "DELETE FROM schema_migrations WHERE name = $1"
        : "DELETE FROM schema_migrations WHERE name = ?",
    values: [lastApplied.name],
  });

  return lastApplied.name;
};

export const status = async (db: Connection, dir: string = "./migrations"): Promise<MigrationStatus[]> => {
  await ensureTable(db);
  const rows = await db.all({
    text: "SELECT name, applied_at FROM schema_migrations",
    values: [],
  });
  const appliedMap = new Map(rows.map((r: any) => [r.name, new Date(r.applied_at)]));
  const files = scanMigrations(dir);

  return files.map((f) => ({
    name: f.name,
    appliedAt: appliedMap.get(f.name) ?? null,
  }));
};
