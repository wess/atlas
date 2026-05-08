export type { ColumnDef, ColumnTs, ColumnType } from "./column.ts";
export { column } from "./column.ts";
import type { ColumnDef, ColumnTs } from "./column.ts";

export type SchemaColumns = Record<string, ColumnDef<any, any>>;

export type Schema<T extends SchemaColumns = SchemaColumns> = {
  readonly table: string;
  readonly columns: T;
};

// RowOf<schema> resolves to the row-shape that schema produces.
// Nullable columns become T | null; non-nullable stay as T.
export type RowOf<S> = S extends Schema<infer T>
  ? { [K in keyof T]: ColumnTs<T[K]> }
  : never;

export const defineSchema = <T extends SchemaColumns>(table: string, columns: T): Schema<T> => ({
  table,
  columns,
});
