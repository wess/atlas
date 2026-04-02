import { createChain } from "../chain/index.ts";
import { createQuery } from "../query/index.ts";
import type { Chainable } from "../types/index.ts";

type SchemaLike = { readonly table: string };

export const from = (table: string | SchemaLike, alias?: string): Chainable => {
  const tableName = typeof table === "string" ? table : table.table;
  return createChain(createQuery(tableName, alias));
};
