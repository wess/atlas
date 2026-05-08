import type { RowOf, Schema, SchemaColumns } from "../schema/index.ts";
import { createChain } from "../chain/index.ts";
import { createQuery } from "../query/index.ts";
import type { Chainable } from "../types/index.ts";

// Two overloads:
//   from(schema, alias?) → Chainable<RowOf<schema>>   (typed)
//   from("users", alias?) → Chainable<any>             (legacy / dynamic)
export function from<S extends Schema<SchemaColumns>>(table: S, alias?: string): Chainable<RowOf<S>>;
export function from(table: string, alias?: string): Chainable<any>;
export function from(table: string | Schema<SchemaColumns>, alias?: string): Chainable<any> {
  const tableName = typeof table === "string" ? table : table.table;
  return createChain(createQuery(tableName, alias));
}
