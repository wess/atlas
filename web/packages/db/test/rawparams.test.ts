import { expect, test } from "bun:test";
import { raw } from "../fragment/index.ts";
import { from } from "../from/index.ts";

test("a repeated $1 binds the same value at every occurrence", () => {
  const { text, values } = from("users")
    .where((q) => q.raw(raw("a = $1 OR b = $1", 5)))
    .where((q) => q("c").equals(9))
    .toSql();
  expect(text).toBe("SELECT * FROM users WHERE a = $1 OR b = $2 AND c = $3");
  expect(values).toEqual([5, 5, 9]);
});

test("out-of-order placeholders bind by number, not position", () => {
  const { text, values } = from("users")
    .where((q) => q("x").equals(0))
    .where((q) => q.raw(raw("b = $2 AND a = $1", "A", "B")))
    .toSql();
  expect(text).toBe("SELECT * FROM users WHERE x = $1 AND b = $2 AND a = $3");
  expect(values).toEqual([0, "B", "A"]);
});

test("sqlite positional placeholders get one value per occurrence", () => {
  const { text, values } = from("users")
    .where((q) => q.raw(raw("a = $1 OR b = $1", 5)))
    .toSql("sqlite");
  expect(text).toBe("SELECT * FROM users WHERE a = ? OR b = ?");
  expect(values).toEqual([5, 5]);
});

test("a value count that doesn't match the highest placeholder throws", () => {
  expect(() =>
    from("users")
      .where((q) => q.raw(raw("a = $1", 1, 2)))
      .toSql(),
  ).toThrow(/placeholder mismatch/);
  expect(() =>
    from("users")
      .where((q) => q.raw(raw("a = $2", 1)))
      .toSql(),
  ).toThrow(/placeholder mismatch/);
  expect(() =>
    from("users")
      .where((q) => q.raw(raw("a = $0")))
      .toSql(),
  ).toThrow();
});
