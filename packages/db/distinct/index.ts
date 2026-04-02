import type { Column, Query } from "../types/index.ts";

export const setDistinct = (query: Query, columns: readonly Column[]): Query => ({
  ...query,
  distinct: columns.length === 0 ? true : [...columns],
});
