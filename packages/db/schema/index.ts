export type { ColumnDef, ColumnType } from "./column.ts";
export { column } from "./column.ts";

export type Schema<T extends Record<string, unknown> = Record<string, unknown>> = {
  readonly table: string;
  readonly columns: T;
};

export const defineSchema = <T extends Record<string, unknown>>(table: string, columns: T): Schema<T> => ({
  table,
  columns,
});
