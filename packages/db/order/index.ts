import type { Column, OrderDirection, Query } from "../types/index.ts";

export const addOrderBy = (
  query: Query,
  column: Column,
  direction: OrderDirection = "ASC",
  nulls?: "FIRST" | "LAST",
): Query => ({
  ...query,
  orderBy: [...query.orderBy, { column, direction, nulls }],
});
