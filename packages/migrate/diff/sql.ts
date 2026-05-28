import type { ColumnType, Dialect } from "../../db/index.ts";
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
const sqlType = (type: ColumnType, dialect: Dialect, _primary: boolean): string =>
  dialect === "postgres" ? PG_TYPES[type] : SQLITE_TYPES[type];

const columnDdl = (col: LiveColumn, dialect: Dialect): string => {
  const parts: string[] = [col.name, sqlType(col.type, dialect, col.primary)];
  if (col.primary) {
    if (dialect === "sqlite") parts.push("PRIMARY KEY");
    else parts.push("PRIMARY KEY");
  }
  if (!col.nullable && !col.primary) parts.push("NOT NULL");
  return parts.join(" ");
};

const createTableSql = (t: LiveTable, dialect: Dialect): string => {
  const lines = t.columns.map((c) => `  ${columnDdl(c, dialect)}`);
  return `CREATE TABLE ${t.name} (\n${lines.join(",\n")}\n);`;
};

const dropTableSql = (t: LiveTable): string => `DROP TABLE ${t.name};`;

const addColumnSql = (table: string, col: LiveColumn, dialect: Dialect): string =>
  `ALTER TABLE ${table} ADD COLUMN ${columnDdl(col, dialect)};`;

const dropColumnSql = (table: string, col: LiveColumn, dialect: Dialect): string => {
  if (dialect === "postgres") return `ALTER TABLE ${table} DROP COLUMN ${col.name};`;
  // SQLite added DROP COLUMN in 3.35 but it's still not universal — emit but
  // warn. The migration runner will execute it on Bun's bundled SQLite (3.45+).
  return `ALTER TABLE ${table} DROP COLUMN ${col.name};`;
};

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
    case "alter_column":
      return { kind: "alter_column", table: op.table, from: op.to, to: op.from };
  }
};

const opToSql = (op: DiffOp, dialect: Dialect): string => {
  switch (op.kind) {
    case "create_table":
      return createTableSql(op.table, dialect);
    case "drop_table":
      return dropTableSql(op.table);
    case "add_column":
      return addColumnSql(op.table, op.column, dialect);
    case "drop_column":
      return dropColumnSql(op.table, op.column, dialect);
    case "alter_column": {
      // Type/nullability changes — emit as a comment so the user reviews.
      const reasons: string[] = [];
      if (op.from.type !== op.to.type) reasons.push(`type ${op.from.type} → ${op.to.type}`);
      if (op.from.nullable !== op.to.nullable) reasons.push(`nullable ${op.from.nullable} → ${op.to.nullable}`);
      return `-- ALTER ${op.table}.${op.from.name} (${reasons.join(", ")}) — review and adjust manually`;
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
