import { createWhereBuilder } from "../predicates/index.ts";
import type { Predicate, Query, WhereCallback } from "../types/index.ts";

export const addWhere = (query: Query, callback: WhereCallback): Query => {
  const builder = createWhereBuilder();
  const result = callback(builder);
  const predicates: readonly Predicate[] = Array.isArray(result) ? result : [result];
  return {
    ...query,
    wheres: [...query.wheres, ...predicates],
  };
};
