import type { Column, Query } from "../types/index.ts";

export const addGroupBy = (query: Query, columns: readonly Column[]): Query => ({
  ...query,
  groupBy: [...query.groupBy, ...columns],
});
