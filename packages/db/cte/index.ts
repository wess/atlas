import type { Chainable, Query } from "../types/index.ts";

export const addCte = (query: Query, name: string, sub: Chainable): Query => ({
  ...query,
  ctes: [...query.ctes, { name, query: sub.toQuery(), recursive: false }],
});

export const addRecursiveCte = (query: Query, name: string, sub: Chainable): Query => ({
  ...query,
  ctes: [...query.ctes, { name, query: sub.toQuery(), recursive: true }],
});
