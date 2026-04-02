import { isFragment } from "../fragment/index.ts";
import type { Query } from "../types/index.ts";
import { validateIdentifier } from "../utils/identifiers.ts";
import type { ParamCounter } from "../utils/params.ts";
import { renumberParams } from "../utils/params.ts";
import { compileReturning, compileWheres } from "./clauses.ts";

export const compileUpdate = (query: Query, counter: ParamCounter, values: any[]): string => {
  validateIdentifier(query.table);

  const columns = Object.keys(query.values);
  const setClauses = columns.map((col) => {
    validateIdentifier(col);
    const val = query.values[col];
    if (isFragment(val)) {
      const renumbered = renumberParams(val.sql, counter);
      values.push(...val.values);
      return `${col} = ${renumbered}`;
    }
    const param = counter.next();
    values.push(val);
    return `${col} = ${param}`;
  });

  const parts: string[] = [`UPDATE ${query.table} SET ${setClauses.join(", ")}`];

  const wheres = compileWheres(query.wheres, counter, values);
  if (wheres) {
    parts.push(wheres);
  }

  const returning = compileReturning(query.returning, counter, values);
  if (returning) {
    parts.push(returning);
  }

  return parts.join(" ");
};
