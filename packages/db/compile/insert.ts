import { isFragment } from "../fragment/index.ts";
import type { Query } from "../types/index.ts";
import { validateIdentifier } from "../utils/identifiers.ts";
import type { ParamCounter } from "../utils/params.ts";
import { renumberParams } from "../utils/params.ts";
import { compileConflict, compileReturning } from "./clauses.ts";

const compileRow = (columns: string[], row: Record<string, any>, counter: ParamCounter, values: any[]): string => {
  const placeholders = columns
    .map((col) => {
      const val = row[col];
      if (isFragment(val)) {
        const renumbered = renumberParams(val.sql, counter);
        values.push(...val.values);
        return renumbered;
      }
      values.push(val);
      return counter.next();
    })
    .join(", ");
  return `(${placeholders})`;
};

export const compileInsert = (
  query: Query,
  counter: ParamCounter,
  values: any[],
  compileSubquery?: (query: Query, counter: ParamCounter, values: any[]) => string,
): string => {
  validateIdentifier(query.table);

  const columns = Object.keys(query.values);
  const columnsSql = columns.map(validateIdentifier).join(", ");

  const parts: string[] = [];

  if (query.insertFromSelect && compileSubquery) {
    const subSql = compileSubquery(query.insertFromSelect, counter, values);
    parts.push(`INSERT INTO ${query.table} (${columnsSql}) ${subSql}`);
  } else if (query.batchValues && query.batchValues.length > 0) {
    const rows = query.batchValues.map((row) => compileRow(columns, row, counter, values));
    parts.push(`INSERT INTO ${query.table} (${columnsSql}) VALUES ${rows.join(", ")}`);
  } else {
    parts.push(
      `INSERT INTO ${query.table} (${columnsSql}) VALUES ${compileRow(columns, query.values, counter, values)}`,
    );
  }

  if (query.conflict) {
    parts.push(compileConflict(query.conflict, columns, counter, values));
  }

  const returning = compileReturning(query.returning, counter, values);
  if (returning) {
    parts.push(returning);
  }

  return parts.join(" ");
};

export const compileTruncate = (query: Query): string => {
  validateIdentifier(query.table);
  return `TRUNCATE TABLE ${query.table}${query.cascade ? " CASCADE" : ""}`;
};
