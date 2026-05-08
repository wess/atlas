import type { ColumnType, Connection } from "@atlas/db";
import type { LiveColumn, LiveTable } from "./types.ts";

// Internal table list — never diffed.
const INTERNAL_TABLES = new Set([
  "schema_migrations",
  "sqlite_sequence",
  "sqlite_master",
  "sqlite_temp_master",
]);

const isInternal = (name: string): boolean =>
  INTERNAL_TABLES.has(name) || name.startsWith("sqlite_") || name.startsWith("pg_");

// Map a Postgres data_type to our ColumnType. Falls back to "text" for unknowns
// — diff still works, the user just won't see a perfect-typed comparison.
const pgType = (dataType: string, udtName: string): ColumnType => {
  const t = dataType.toLowerCase();
  const u = udtName.toLowerCase();
  if (t === "integer" || u === "int4" || u === "int" || u === "serial") return "integer";
  if (t === "bigint" || u === "int8") return "bigint";
  if (t === "real" || t === "double precision" || u === "float4" || u === "float8") return "real";
  if (t === "boolean" || u === "bool") return "boolean";
  if (t.startsWith("timestamp")) return "timestamp";
  if (t === "uuid") return "uuid";
  if (t === "json" || t === "jsonb") return "json";
  return "text";
};

const introspectPostgres = async (db: Connection): Promise<LiveTable[]> => {
  const rows: any[] = await db.all({
    text: `
      SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default,
        EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = c.table_schema
            AND tc.table_name = c.table_name
            AND kcu.column_name = c.column_name
        ) AS is_primary
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position
    `,
    values: [],
  });

  const byTable = new Map<string, LiveColumn[]>();
  for (const r of rows) {
    if (isInternal(r.table_name)) continue;
    const list = byTable.get(r.table_name) ?? [];
    list.push({
      name: r.column_name,
      type: pgType(r.data_type, r.udt_name),
      nullable: String(r.is_nullable).toUpperCase() === "YES",
      primary: r.is_primary === true || r.is_primary === "t",
      hasDefault: r.column_default !== null && r.column_default !== undefined,
    });
    byTable.set(r.table_name, list);
  }

  return [...byTable.entries()].map(([name, columns]) => ({ name, columns }));
};

const sqliteType = (declared: string): ColumnType => {
  const t = declared.toUpperCase();
  if (t.includes("INT")) return t.includes("BIG") ? "bigint" : "integer";
  if (t.includes("REAL") || t.includes("FLOA") || t.includes("DOUB")) return "real";
  if (t.includes("BOOL")) return "boolean";
  if (t.includes("TIME") || t.includes("DATE")) return "timestamp";
  if (t.includes("UUID")) return "uuid";
  if (t.includes("JSON")) return "json";
  return "text";
};

const introspectSqlite = async (db: Connection): Promise<LiveTable[]> => {
  const tables: any[] = await db.all({
    text: `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    values: [],
  });

  const result: LiveTable[] = [];
  for (const t of tables) {
    const name = t.name as string;
    if (isInternal(name)) continue;
    // PRAGMA can't be parameterized; the table name comes from sqlite_master so
    // it's only ever a real table name (not user-supplied).
    const cols: any[] = await db.all({ text: `PRAGMA table_info(${name})`, values: [] });
    result.push({
      name,
      columns: cols.map((c) => ({
        name: c.name as string,
        type: sqliteType(String(c.type ?? "")),
        nullable: c.notnull === 0,
        primary: c.pk > 0,
        hasDefault: c.dflt_value !== null && c.dflt_value !== undefined,
      })),
    });
  }
  return result;
};

export const introspect = async (db: Connection): Promise<LiveTable[]> => {
  if (db.dialect === "postgres") return introspectPostgres(db);
  return introspectSqlite(db);
};
