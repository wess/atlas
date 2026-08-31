import type { Query } from "../types/index.ts";

export const createQuery = (table: string, alias?: string): Query => ({
  type: "select",
  table,
  alias,
  columns: [],
  wheres: [],
  joins: [],
  orderBy: [],
  groupBy: [],
  having: [],
  returning: [],
  distinct: false,
  values: {},
  ctes: [],
});
