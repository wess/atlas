import { expect, test } from "bun:test";
import { connectSqlite } from "../drivers/sqlite.ts";
import { from } from "../from/index.ts";
import { column, defineSchema, type RowOf } from "../schema/index.ts";

// Helpers for compile-time assertions. These never execute.
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
const assertEquals = <_X extends true>() => undefined;

test("RowOf infers row shape from defineSchema", async () => {
  const users = defineSchema("users", {
    id: column.serial().primaryKey(),
    email: column.text().unique(),
    name: column.text(),
    bio: column.text().nullable(),
    createdAt: column.timestamp().default(new Date()),
    settings: column.json<{ theme: string }>().nullable(),
  });

  type User = RowOf<typeof users>;
  type Expected = {
    id: number;
    email: string;
    name: string;
    bio: string | null;
    createdAt: Date;
    settings: { theme: string } | null;
  };
  assertEquals<Equals<User, Expected>>();

  // Runtime smoke: schema still functions normally.
  expect(users.table).toBe("users");
  expect(users.columns.id.primary).toBe(true);
  expect(users.columns.bio.isNullable).toBe(true);
});

test(".returning narrows like .select; insert returns typed rows", async () => {
  const users = defineSchema("users", {
    id: column.serial().primaryKey(),
    email: column.text(),
    name: column.text(),
  });

  const db = connectSqlite(":memory:");
  await db.execute({ text: "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, name TEXT)", values: [] });

  const inserted = await db.execute(from(users).insert({ email: "x@y.z", name: "Bob" }).returning("id", "email"));
  type InsertedRow = (typeof inserted)[number];
  assertEquals<Equals<InsertedRow, { id: number; email: string }>>();
  expect(inserted[0]?.id).toBe(1);
  expect(inserted[0]?.email).toBe("x@y.z");

  await db.close();
});

test("from(schema) yields a typed Chainable; .select narrows; db.all/one infer", async () => {
  const users = defineSchema("users", {
    id: column.serial().primaryKey(),
    email: column.text(),
    name: column.text(),
  });

  const db = connectSqlite(":memory:");
  await db.execute({ text: "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, name TEXT)", values: [] });
  await db.execute(from(users).insert({ email: "a@b.c", name: "Ada" }));

  // Untyped path (string table) keeps returning unknown unless caller annotates.
  const anyRow = await db.one(from("users"));
  expect(anyRow).not.toBeNull();

  // .all on a schema-typed chain returns RowOf<schema>[].
  const all = await db.all(from(users));
  type AllRow = (typeof all)[number];
  assertEquals<Equals<AllRow, { id: number; email: string; name: string }>>();
  expect(all[0]).toEqual({ id: 1, email: "a@b.c", name: "Ada" });

  // .select narrows the row to the picked keys.
  const trimmed = await db.all(from(users).select("id", "email"));
  type TrimmedRow = (typeof trimmed)[number];
  assertEquals<Equals<TrimmedRow, { id: number; email: string }>>();
  expect(trimmed[0]).toEqual({ id: 1, email: "a@b.c" });

  // .one returns Row | null.
  const found = await db.one(from(users).where((q) => q("id").equals(1)));
  type Found = typeof found;
  assertEquals<Equals<Found, { id: number; email: string; name: string } | null>>();

  await db.close();
});
