import { isFragment } from "../fragment/index.ts";
import type { Column, ConflictSpec, CteSpec, JoinSpec, OrderSpec, Predicate } from "../types/index.ts";
import { validateIdentifier } from "../utils/identifiers.ts";
import type { ParamCounter } from "../utils/params.ts";
import { renumberParams } from "../utils/params.ts";

const compileColumn = (col: Column, counter: ParamCounter, values: any[]): string => {
  if (isFragment(col)) {
    const renumbered = renumberParams(col.sql, counter);
    values.push(...col.values);
    return renumbered;
  }
  return col;
};

const compilePredicate = (pred: Predicate, counter: ParamCounter, values: any[]): string => {
  if (pred.children && pred.children.length > 0) {
    const parts = pred.children.map((child) => compilePredicate(child, counter, values));
    return `(${parts.join(" OR ")})`;
  }

  if (isFragment(pred.column) && pred.value === "__raw__") {
    const renumbered = renumberParams(pred.column.sql, counter);
    values.push(...pred.column.values);
    return renumbered;
  }

  const col = compileColumn(pred.column, counter, values);

  if (pred.op === "IS" || pred.op === "IS NOT") {
    return `${col} ${pred.op} NULL`;
  }

  if (pred.op === "IN" || pred.op === "NOT IN") {
    const arr = pred.value as readonly any[];
    const placeholders = arr.map(() => counter.next()).join(", ");
    values.push(...arr);
    return `${col} ${pred.op} (${placeholders})`;
  }

  if (isFragment(pred.value)) {
    const fragSql = renumberParams(pred.value.sql, counter);
    values.push(...pred.value.values);
    return `${col} ${pred.op} ${fragSql}`;
  }

  const param = counter.next();
  values.push(pred.value);
  return `${col} ${pred.op} ${param}`;
};

export const compileWheres = (wheres: readonly Predicate[], counter: ParamCounter, values: any[]): string => {
  if (wheres.length === 0) {
    return "";
  }

  const parts = wheres.map((pred, i) => {
    const prefix = i === 0 ? "WHERE" : pred.conjunction;
    const compiled = compilePredicate(pred, counter, values);
    return `${prefix} ${compiled}`;
  });

  return parts.join(" ");
};

export const compileJoins = (joins: readonly JoinSpec[]): string => {
  if (joins.length === 0) {
    return "";
  }

  return joins
    .map((j) => {
      validateIdentifier(j.table);
      const alias = j.alias ? ` ${validateIdentifier(j.alias)}` : "";
      const on = isFragment(j.on) ? j.on.sql : j.on;
      return `${j.type} JOIN ${j.table}${alias} ON ${on}`;
    })
    .join(" ");
};

export const compileOrderBy = (specs: readonly OrderSpec[], counter: ParamCounter, values: any[]): string => {
  if (specs.length === 0) {
    return "";
  }

  const parts = specs.map((spec) => {
    const col = compileColumn(spec.column, counter, values);
    const nulls = spec.nulls ? ` NULLS ${spec.nulls}` : "";
    return `${col} ${spec.direction}${nulls}`;
  });

  return `ORDER BY ${parts.join(", ")}`;
};

export const compileGroupBy = (cols: readonly Column[], counter: ParamCounter, values: any[]): string => {
  if (cols.length === 0) {
    return "";
  }

  const parts = cols.map((col) => compileColumn(col, counter, values));
  return `GROUP BY ${parts.join(", ")}`;
};

export const compileHaving = (clauses: readonly Predicate[], counter: ParamCounter, values: any[]): string => {
  if (clauses.length === 0) {
    return "";
  }

  const parts = clauses.map((pred, i) => {
    const prefix = i === 0 ? "HAVING" : pred.conjunction;
    const compiled = compilePredicate(pred, counter, values);
    return `${prefix} ${compiled}`;
  });

  return parts.join(" ");
};

export const compileReturning = (cols: readonly Column[], counter: ParamCounter, values: any[]): string => {
  if (cols.length === 0) {
    return "";
  }

  const parts = cols.map((col) => compileColumn(col, counter, values));
  return `RETURNING ${parts.join(", ")}`;
};

export const compileConflict = (
  spec: ConflictSpec,
  insertColumns: readonly string[],
  counter: ParamCounter,
  values: any[],
): string => {
  const target = spec.target.map(validateIdentifier).join(", ");

  if (spec.action === "nothing") {
    return `ON CONFLICT (${target}) DO NOTHING`;
  }

  const columnsToUpdate = spec.updateColumns
    ? spec.updateColumns
    : insertColumns.filter((col) => !spec.target.includes(col) && !(spec.excludeFromUpdate ?? []).includes(col));

  const setClauses = columnsToUpdate.map((col) => `${validateIdentifier(col)} = EXCLUDED.${col}`);

  if (spec.setExtra) {
    for (const [col, val] of Object.entries(spec.setExtra)) {
      validateIdentifier(col);
      if (isFragment(val)) {
        const renumbered = renumberParams(val.sql, counter);
        values.push(...val.values);
        setClauses.push(`${col} = ${renumbered}`);
      } else {
        setClauses.push(`${col} = ${counter.next()}`);
        values.push(val);
      }
    }
  }

  return `ON CONFLICT (${target}) DO UPDATE SET ${setClauses.join(", ")}`;
};

export const compileCtes = (
  ctes: readonly CteSpec[],
  counter: ParamCounter,
  values: any[],
  compileSubquery: (query: any, counter: ParamCounter, values: any[]) => string,
): string => {
  if (ctes.length === 0) {
    return "";
  }

  const hasRecursive = ctes.some((c) => c.recursive);
  const prefix = hasRecursive ? "WITH RECURSIVE" : "WITH";

  const parts = ctes.map((cte) => {
    validateIdentifier(cte.name);
    const cols = cte.columns ? ` (${cte.columns.map(validateIdentifier).join(", ")})` : "";
    const subSql = compileSubquery(cte.query, counter, values);
    return `${cte.name}${cols} AS (${subSql})`;
  });

  return `${prefix} ${parts.join(", ")}`;
};
