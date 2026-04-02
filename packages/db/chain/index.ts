import { toSql } from "../compile/index.ts";
import { setOnConflict } from "../conflict/index.ts";
import { addCte, addRecursiveCte } from "../cte/index.ts";
import { setDelete } from "../delete/index.ts";
import { setDistinct } from "../distinct/index.ts";
import { addGroupBy } from "../group/index.ts";
import { addHaving } from "../having/index.ts";
import { setInsert, setInsertFrom, setInsertMany, setTruncate } from "../insert/index.ts";
import { addInnerJoin, addJoin, addLeftJoin } from "../join/index.ts";
import { setLimit, setOffset } from "../limit/index.ts";
import { addOrderBy } from "../order/index.ts";
import { setReturning } from "../returning/index.ts";
import { addSelect } from "../select/index.ts";
import type {
  Chainable,
  Column,
  ConflictSpec,
  Dialect,
  Fragment,
  OrderDirection,
  Query,
  WhereCallback,
} from "../types/index.ts";
import { setUpdate } from "../update/index.ts";
import { addWhere } from "../where/index.ts";

export const createChain = (query: Query): Chainable => ({
  select: (...cols: Column[]) => createChain(addSelect(query, cols)),
  where: (cb: WhereCallback) => createChain(addWhere(query, cb)),
  join: (table: string, on: string | Fragment, alias?: string) =>
    createChain(addJoin(query, "INNER", table, on, alias)),
  leftJoin: (table: string, on: string | Fragment, alias?: string) => createChain(addLeftJoin(query, table, on, alias)),
  innerJoin: (table: string, on: string | Fragment, alias?: string) =>
    createChain(addInnerJoin(query, table, on, alias)),
  orderBy: (col: Column, dir: OrderDirection = "ASC", nulls?: "FIRST" | "LAST") =>
    createChain(addOrderBy(query, col, dir, nulls)),
  groupBy: (...cols: Column[]) => createChain(addGroupBy(query, cols)),
  having: (cb: WhereCallback) => createChain(addHaving(query, cb)),
  limit: (n: number) => createChain(setLimit(query, n)),
  offset: (n: number) => createChain(setOffset(query, n)),
  returning: (...cols: Column[]) => createChain(setReturning(query, cols)),
  distinct: (...cols: Column[]) => createChain(setDistinct(query, cols)),
  insert: (data: Record<string, any>) => createChain(setInsert(query, data)),
  insertMany: (data: readonly Record<string, any>[]) => createChain(setInsertMany(query, data)),
  insertFrom: (columns: readonly string[], source: Chainable) => createChain(setInsertFrom(query, columns, source)),
  truncate: (cascade = false) => createChain(setTruncate(query, cascade)),
  update: (data: Record<string, any>) => createChain(setUpdate(query, data)),
  del: () => createChain(setDelete(query)),
  onConflict: (spec: ConflictSpec) => createChain(setOnConflict(query, spec)),
  cte: (name: string, sub: Chainable) => createChain(addCte(query, name, sub)),
  recursiveCte: (name: string, sub: Chainable) => createChain(addRecursiveCte(query, name, sub)),
  toSql: (dialect?: Dialect) => toSql(query, dialect),
  toQuery: () => query,
});
