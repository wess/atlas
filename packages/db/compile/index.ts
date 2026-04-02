import type { Dialect, Query, SqlResult } from "../types/index.ts";
import type { ParamCounter } from "../utils/params.ts";
import { compileCtes } from "./clauses.ts";
import { compileDelete } from "./delete.ts";
import { createDialectCounter } from "./dialect.ts";
import { compileInsert, compileTruncate } from "./insert.ts";
import { compileSelect } from "./select.ts";
import { compileUpdate } from "./update.ts";

const compileQuery = (query: Query, counter: ParamCounter, values: any[]): string => {
  switch (query.type) {
    case "select":
      return compileSelect(query, counter, values);
    case "insert":
      return compileInsert(query, counter, values, compileQuery);
    case "update":
      return compileUpdate(query, counter, values);
    case "delete":
      return compileDelete(query, counter, values);
    case "truncate":
      return compileTruncate(query);
    default:
      throw new Error(`Unknown query type: ${query.type}`);
  }
};

export const toSql = (query: Query, dialect: Dialect = "postgres"): SqlResult => {
  const counter = createDialectCounter(dialect);
  const values: any[] = [];

  const ctesSql = compileCtes(query.ctes, counter, values, compileQuery);
  const mainSql = compileQuery(query, counter, values);

  const text = ctesSql ? `${ctesSql} ${mainSql}` : mainSql;

  return { text, values };
};
