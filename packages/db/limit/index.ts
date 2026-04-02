import type { Query } from "../types/index.ts";

export const setLimit = (query: Query, n: number): Query => ({
  ...query,
  limitValue: n,
});

export const setOffset = (query: Query, n: number): Query => ({
  ...query,
  offsetValue: n,
});
