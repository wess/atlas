import { expect, test } from "bun:test";
import { renderInverseSql, renderSql } from "../diff/sql.ts";
import type { LiveColumn } from "../diff/types.ts";

const col = (name: string, nullable: boolean): LiveColumn => ({
  name,
  type: "text",
  nullable,
  primary: false,
  unique: false,
  hasDefault: false,
  defaultSql: null,
});

test("a live column name with a newline can't escape the review comment", () => {
  const name = "x\nDROP TABLE users;\n--";
  const ops = [{ kind: "alter_column" as const, table: "t", from: col(name, true), to: col(name, false) }];
  for (const sql of [renderSql(ops, "postgres"), renderInverseSql(ops, "sqlite")]) {
    expect(sql.split("\n").length).toBe(1);
    expect(sql.startsWith("-- ALTER t.x DROP TABLE users;")).toBe(true);
  }
});

test("names with \\r or unicode line separators are flattened too", () => {
  const name = "a\rb c";
  const ops = [{ kind: "alter_column" as const, table: "t", from: col(name, true), to: col(name, false) }];
  expect(renderSql(ops, "postgres")).toContain("t.a b c (");
});
