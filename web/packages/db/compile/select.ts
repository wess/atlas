import { isFragment } from "../fragment/index.ts";
import type { Column, Query } from "../types/index.ts";
import { validateIdentifier } from "../utils/identifiers.ts";
import type { ParamCounter } from "../utils/params.ts";
import { renumberParams } from "../utils/params.ts";
import { compileGroupBy, compileHaving, compileJoins, compileOrderBy, compileWheres } from "./clauses.ts";

const compileColumns = (cols: readonly Column[], counter: ParamCounter, values: any[]): string => {
  if (cols.length === 0) {
    return "*";
  }

  return cols
    .map((col) => {
      if (isFragment(col)) {
        const renumbered = renumberParams(col.sql, counter);
        values.push(...col.values);
        return renumbered;
      }
      return col;
    })
    .join(", ");
};

export const compileSelect = (query: Query, counter: ParamCounter, values: any[]): string => {
  validateIdentifier(query.table);
  if (query.alias) {
    validateIdentifier(query.alias);
  }

  const parts: string[] = ["SELECT"];

  if (query.distinct === true) {
    parts.push("DISTINCT");
  } else if (Array.isArray(query.distinct) && query.distinct.length > 0) {
    const distinctCols = (query.distinct as readonly Column[])
      .map((col) => {
        if (isFragment(col)) {
          const renumbered = renumberParams(col.sql, counter);
          values.push(...col.values);
          return renumbered;
        }
        return col;
      })
      .join(", ");
    parts.push(`DISTINCT ON (${distinctCols})`);
  }

  parts.push(compileColumns(query.columns, counter, values));

  const tableRef = query.alias ? `${query.table} ${query.alias}` : query.table;
  parts.push(`FROM ${tableRef}`);

  const joins = compileJoins(query.joins);
  if (joins) {
    parts.push(joins);
  }

  const wheres = compileWheres(query.wheres, counter, values);
  if (wheres) {
    parts.push(wheres);
  }

  const groupBy = compileGroupBy(query.groupBy, counter, values);
  if (groupBy) {
    parts.push(groupBy);
  }

  const having = compileHaving(query.having, counter, values);
  if (having) {
    parts.push(having);
  }

  const orderBy = compileOrderBy(query.orderBy, counter, values);
  if (orderBy) {
    parts.push(orderBy);
  }

  if (query.limitValue !== undefined) {
    parts.push(`LIMIT ${counter.next()}`);
    values.push(query.limitValue);
  }

  if (query.offsetValue !== undefined) {
    parts.push(`OFFSET ${counter.next()}`);
    values.push(query.offsetValue);
  }

  return parts.join(" ");
};
