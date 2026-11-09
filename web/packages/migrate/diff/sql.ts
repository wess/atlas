import type { ColumnType, Dialect } from "../../db/query.ts";
import type { DiffOp, LiveColumn, LiveTable } from "./types.ts";

const PG_TYPES: Record<ColumnType, string> = {
  serial: "SERIAL",
  text: "TEXT",
  integer: "INTEGER",
  bigint: "BIGINT",
  real: "DOUBLE PRECISION",
  boolean: "BOOLEAN",
  timestamp: "TIMESTAMPTZ",
  json: "JSONB",
  uuid: "UUID",
};

const SQLITE_TYPES: Record<ColumnType, string> = {
  serial: "INTEGER",
  text: "TEXT",
  integer: "INTEGER",
  bigint: "INTEGER",
  real: "REAL",
  boolean: "INTEGER",
  timestamp: "TIMESTAMP",
  json: "TEXT",
  uuid: "TEXT",
};

// Map our normalized ColumnType to dialect-specific SQL type.
export const sqlType = (type: ColumnType, dialect: Dialect): string =>
  dialect === "postgres" ? PG_TYPES[type] : SQLITE_TYPES[type];

const indexName = (table: string, column: string) => `${table}_${column}_key`;
const createIndexSql = (table: string, column: string) =>
  `CREATE UNIQUE INDEX ${indexName(table, column)} ON ${table} (${column});`;

const columnDdl = (col: LiveColumn, dialect: Dialect): string => {
  const parts: string[] = [col.name, sqlType(col.type, dialect)];
  if (col.primary) {
    if (dialect === "sqlite") parts.push("PRIMARY KEY");
    else parts.push("PRIMARY KEY");
  }
  if (!col.nullable && !col.primary) parts.push("NOT NULL");
  if (col.defaultSql) parts.push(`DEFAULT ${col.defaultSql}`);
  return parts.join(" ");
};

const createTableSql = (t: LiveTable, dialect: Dialect): string => {
  const lines = t.columns.map((c) => `  ${columnDdl(c, dialect)}${c.unique ? " UNIQUE" : ""}`);
  return `CREATE TABLE ${t.name} (\n${lines.join(",\n")}\n);`;
};

const dropTableSql = (t: LiveTable): string => `DROP TABLE ${t.name};`;

// sqlite refuses ADD COLUMN ... UNIQUE, so the constraint is always a separate index here
const addColumnSql = (table: string, col: LiveColumn, dialect: Dialect): string =>
  [
    `ALTER TABLE ${table} ADD COLUMN ${columnDdl(col, dialect)};`,
    ...(col.unique ? [createIndexSql(table, col.name)] : []),
  ].join("\n");

// sqlite won't drop a column that still has an index. Bun's bundled sqlite has DROP COLUMN (3.35+).
const dropColumnSql = (table: string, col: LiveColumn): string =>
  [
    ...(col.unique ? [`DROP INDEX IF EXISTS ${indexName(table, col.name)};`] : []),
    `ALTER TABLE ${table} DROP COLUMN ${col.name};`,
  ].join("\n");

// Build an inverse op so we can compose down.sql.
const inverseOp = (op: DiffOp): DiffOp => {
  switch (op.kind) {
    case "create_table":
      return { kind: "drop_table", table: op.table };
    case "drop_table":
      return { kind: "create_table", table: op.table };
    case "add_column":
      return { kind: "drop_column", table: op.table, column: op.column };
    case "drop_column":
      return { kind: "add_column", table: op.table, column: op.column };
    case "add_unique":
      return { kind: "drop_unique", table: op.table, column: op.column };
    case "drop_unique":
      return { kind: "add_unique", table: op.table, column: op.column };
    case "alter_column":
      return { kind: "alter_column", table: op.table, from: op.to, to: op.from };
  }
};

// Names in a `--` comment come from the live database. A newline (or any other
// line break or control character) in one would end the comment and turn the
// rest of the name into SQL in the generated migration.
export const commentSafe = (text: string): string =>
  [...text]
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code < 32 || code === 127 || code === 0x2028 || code === 0x2029 ? " " : ch;
    })
    .join("");

const opToSql = (op: DiffOp, dialect: Dialect): string => {
  switch (op.kind) {
    case "create_table":
      return createTableSql(op.table, dialect);
    case "drop_table":
      return dropTableSql(op.table);
    case "add_column":
      return addColumnSql(op.table, op.column, dialect);
    case "drop_column":
      return dropColumnSql(op.table, op.column);
    case "add_unique":
      return createIndexSql(op.table, op.column);
    case "drop_unique":
      return `DROP INDEX ${indexName(op.table, op.column)};`;
    case "alter_column": {
      // Type/nullability changes — emit as a comment so the user reviews.
      const reasons: string[] = [];
      if (sqlType(op.from.type, dialect) !== sqlType(op.to.type, dialect))
        reasons.push(`type ${op.from.type} → ${op.to.type}`);
      if (op.from.nullable !== op.to.nullable) reasons.push(`nullable ${op.from.nullable} → ${op.to.nullable}`);
      if (op.from.unique !== op.to.unique) reasons.push(`unique ${op.from.unique} → ${op.to.unique}`);
      return commentSafe(`-- ALTER ${op.table}.${op.from.name} (${reasons.join(", ")}) — review and adjust manually`);
    }
  }
};

export const renderSql = (ops: readonly DiffOp[], dialect: Dialect): string =>
  ops.map((op) => opToSql(op, dialect)).join("\n\n");

export const renderInverseSql = (ops: readonly DiffOp[], dialect: Dialect): string =>
  [...ops]
    .reverse()
    .map((op) => opToSql(inverseOp(op), dialect))
    .join("\n\n");
