import type { Column, ColumnBuilder, Fragment, Predicate, WhereBuilder } from "../types/index.ts";

const makePredicate = (
  column: Column,
  op: Predicate["op"],
  value: any,
  conjunction: "AND" | "OR" = "AND",
): Predicate => ({
  __brand: "predicate" as const,
  column,
  op,
  value,
  conjunction,
});

const makeOrPredicate = (children: readonly Predicate[]): Predicate => ({
  __brand: "predicate" as const,
  column: "__or__",
  op: "=",
  value: null,
  conjunction: "AND",
  children,
});

const makeRawPredicate = (fragment: Fragment): Predicate => ({
  __brand: "predicate" as const,
  column: fragment,
  op: "=",
  value: "__raw__",
  conjunction: "AND",
});

export const createColumnBuilder = (col: Column): ColumnBuilder => ({
  equals: (value: any) => makePredicate(col, "=", value),
  notEquals: (value: any) => makePredicate(col, "!=", value),
  greaterThan: (value: any) => makePredicate(col, ">", value),
  greaterThanOrEqual: (value: any) => makePredicate(col, ">=", value),
  lessThan: (value: any) => makePredicate(col, "<", value),
  lessThanOrEqual: (value: any) => makePredicate(col, "<=", value),
  isNull: () => makePredicate(col, "IS", null),
  isNotNull: () => makePredicate(col, "IS NOT", null),
  inList: (values: readonly any[]) => makePredicate(col, "IN", values),
  notInList: (values: readonly any[]) => makePredicate(col, "NOT IN", values),
  like: (value: any) => makePredicate(col, "LIKE", value),
  ilike: (value: any) => makePredicate(col, "ILIKE", value),
});

export const createWhereBuilder = (): WhereBuilder => {
  const builder = ((col: Column) => createColumnBuilder(col)) as WhereBuilder;
  (builder as any).or = (...predicates: Predicate[]) => makeOrPredicate(predicates);
  (builder as any).raw = (fragment: Fragment) => makeRawPredicate(fragment);
  return builder;
};

export const isPredicate = (value: unknown): value is Predicate =>
  typeof value === "object" && value !== null && "__brand" in value && (value as Predicate).__brand === "predicate";
