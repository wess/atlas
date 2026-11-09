import type { ColumnDef, ColumnType, Schema } from "../../db/query.ts";
import type { LiveColumn, LiveTable } from "./types.ts";

// .default(value) holds a JS value, and DDL needs it as SQL
const literal = (value: unknown): string | null => {
  if (value === undefined) return null;
  if (value === null) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const text = value instanceof Date ? value.toISOString() : typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replaceAll("'", "''")}'`;
};

// Convert a defineSchema() result into the same shape as the introspected DB.
export const tableFromSchema = (schema: Schema): LiveTable => {
  const cols: LiveColumn[] = [];
  for (const [name, def] of Object.entries(schema.columns)) {
    const c = def as ColumnDef<unknown, boolean>;
    cols.push({
      name,
      type: c.type as ColumnType,
      nullable: c.isNullable === true,
      primary: c.primary === true,
      unique: c.isUnique === true && c.primary !== true,
      hasDefault: c.defaultValue !== undefined || c.defaultSql != null,
      defaultSql: c.defaultSql ?? literal(c.defaultValue),
    });
  }
  return { name: schema.table, columns: cols };
};

export const tablesFromSchemas = (schemas: readonly Schema[]): LiveTable[] => schemas.map(tableFromSchema);
