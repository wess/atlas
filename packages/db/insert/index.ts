import type { Chainable, Query } from "../types/index.ts";

export const setInsert = (query: Query, data: Record<string, any>): Query => ({
  ...query,
  type: "insert",
  values: { ...data },
});

export const setInsertMany = (query: Query, data: readonly Record<string, any>[]): Query => ({
  ...query,
  type: "insert",
  values: data.length > 0 ? { ...data[0] } : {},
  batchValues: data,
});

export const setInsertFrom = (query: Query, columns: readonly string[], source: Chainable): Query => {
  const placeholder: Record<string, any> = {};
  for (const col of columns) {
    placeholder[col] = "__from__";
  }
  return {
    ...query,
    type: "insert",
    values: placeholder,
    insertFromSelect: source.toQuery(),
  };
};

export const setTruncate = (query: Query, cascade: boolean): Query => ({
  ...query,
  type: "truncate",
  cascade,
});
