import { expect, test } from "bun:test";
import { from } from "../from/index.ts";
import { column, defineSchema } from "../schema/index.ts";

test("defineSchema creates a schema with table name", () => {
  const users = defineSchema("users", {
    id: column.serial().primaryKey(),
    email: column.text().unique(),
    name: column.text(),
  });
  expect(users.table).toBe("users");
  expect(users.columns.id.type).toBe("serial");
  expect(users.columns.id.primary).toBe(true);
  expect(users.columns.email.type).toBe("text");
  expect(users.columns.email.isUnique).toBe(true);
});

test("column types", () => {
  expect(column.serial().type).toBe("serial");
  expect(column.text().type).toBe("text");
  expect(column.integer().type).toBe("integer");
  expect(column.boolean().type).toBe("boolean");
  expect(column.timestamp().type).toBe("timestamp");
  expect(column.json().type).toBe("json");
  expect(column.uuid().type).toBe("uuid");
});

test("column modifiers are immutable", () => {
  const base = column.text();
  const nullable = base.nullable();
  const withDefault = base.default("hello");
  expect(base.isNullable).toBe(false);
  expect(nullable.isNullable).toBe(true);
  expect(withDefault.defaultValue).toBe("hello");
  expect(base.defaultValue).toBeUndefined();
});

test("schema can be used with from()", () => {
  const users = defineSchema("users", {
    id: column.serial().primaryKey(),
    email: column.text(),
  });
  const { text } = from(users).select("id", "email").toSql();
  expect(text).toBe("SELECT id, email FROM users");
});
