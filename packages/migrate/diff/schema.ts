import type { ColumnDef, ColumnType, Schema } from "../../db/index.ts";
import type { LiveColumn, LiveTable } from "./types.ts";

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
      hasDefault: c.defaultValue !== undefined,
    });
  }
  return { name: schema.table, columns: cols };
};

export const tablesFromSchemas = (schemas: readonly Schema[]): LiveTable[] => schemas.map(tableFromSchema);
