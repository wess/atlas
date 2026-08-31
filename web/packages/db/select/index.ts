import type { Column, Query } from "../types/index.ts";

export const addSelect = (query: Query, columns: readonly Column[]): Query => ({
  ...query,
  columns: [...query.columns, ...columns],
});
