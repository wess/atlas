import type { Column, Query } from "../types/index.ts";

export const setReturning = (query: Query, columns: readonly Column[]): Query => ({
  ...query,
  returning: [...columns],
});
