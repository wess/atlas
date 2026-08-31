import { expect, test } from "bun:test";
import { from } from "../from/index.ts";

test("sqlite dialect uses ? params", () => {
  const { text, values } = from("users")
    .where((q) => q("email").equals("test@test.com"))
    .toSql("sqlite");
  expect(text).toBe("SELECT * FROM users WHERE email = ?");
  expect(values).toEqual(["test@test.com"]);
});

test("sqlite dialect with multiple params", () => {
  const { text, values } = from("users")
    .where((q) => q("active").equals(true))
    .limit(10)
    .toSql("sqlite");
  expect(text).toBe("SELECT * FROM users WHERE active = ? LIMIT ?");
  expect(values).toEqual([true, 10]);
});

test("postgres dialect uses $N params (default)", () => {
  const { text } = from("users")
    .where((q) => q("id").equals(1))
    .toSql("postgres");
  expect(text).toBe("SELECT * FROM users WHERE id = $1");
});

test("default dialect is postgres", () => {
  const { text } = from("users")
    .where((q) => q("id").equals(1))
    .toSql();
  expect(text).toBe("SELECT * FROM users WHERE id = $1");
});

test("sqlite insert", () => {
  const { text, values } = from("users").insert({ email: "test@test.com", name: "Test" }).toSql("sqlite");
  expect(text).toBe("INSERT INTO users (email, name) VALUES (?, ?)");
  expect(values).toEqual(["test@test.com", "Test"]);
});

test("sqlite update with where", () => {
  const { text, values } = from("users")
    .update({ name: "Updated" })
    .where((q) => q("id").equals(1))
    .toSql("sqlite");
  expect(text).toBe("UPDATE users SET name = ? WHERE id = ?");
  expect(values).toEqual(["Updated", 1]);
});
