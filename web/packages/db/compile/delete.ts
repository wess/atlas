import type { Query } from "../types/index.ts";
import { validateIdentifier } from "../utils/identifiers.ts";
import type { ParamCounter } from "../utils/params.ts";
import { compileReturning, compileWheres } from "./clauses.ts";

export const compileDelete = (query: Query, counter: ParamCounter, values: any[]): string => {
  validateIdentifier(query.table);

  const parts: string[] = [`DELETE FROM ${query.table}`];

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
