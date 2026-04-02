import type { Fragment, JoinType, Query } from "../types/index.ts";

const addJoinSpec = (query: Query, type: JoinType, table: string, on: string | Fragment, alias?: string): Query => ({
  ...query,
  joins: [...query.joins, { type, table, alias, on }],
});

export const addJoin = (query: Query, type: JoinType, table: string, on: string | Fragment, alias?: string): Query =>
  addJoinSpec(query, type, table, on, alias);

export const addLeftJoin = (query: Query, table: string, on: string | Fragment, alias?: string): Query =>
  addJoinSpec(query, "LEFT", table, on, alias);

export const addInnerJoin = (query: Query, table: string, on: string | Fragment, alias?: string): Query =>
  addJoinSpec(query, "INNER", table, on, alias);
