import { expect, test } from "bun:test";
import { raw } from "../fragment/index.ts";
import { from } from "../from/index.ts";

const sql = (q: { toSql: () => { text: string } }) => q.toSql().text;

test("orderBy rejects a column carrying SQL", () => {
  expect(() => sql(from("users").orderBy("id; DROP TABLE users--"))).toThrow(/Use raw\(\)/);
});

test("orderBy rejects a direction outside ASC/DESC", () => {
  const dir = "ASC, (SELECT password FROM admins)" as any;
  expect(() => sql(from("users").orderBy("id", dir))).toThrow(/sort direction/);
  expect(() => sql(from("users").orderBy("id", "ASC", "LAST; DROP TABLE x" as any))).toThrow(/NULLS/);
});

test("orderBy accepts any case and emits uppercase", () => {
  expect(sql(from("users").orderBy("created_at", "desc" as any, "last" as any))).toBe(
    "SELECT * FROM users ORDER BY created_at DESC NULLS LAST",
  );
  expect(sql(from("users").orderBy("u.name"))).toBe("SELECT * FROM users ORDER BY u.name ASC");
});

test("where column must be an identifier", () => {
  expect(() => sql(from("users").where((q) => q("name = 'x' OR 1=1 --").equals(1)))).toThrow(/Use raw\(\)/);
  expect(sql(from("users").where((q) => q("u.email").equals("a")))).toBe("SELECT * FROM users WHERE u.email = $1");
});

test("groupBy, distinct, returning reject expressions", () => {
  expect(() => sql(from("users").groupBy("id; DROP TABLE users"))).toThrow(/Use raw\(\)/);
  expect(() => sql(from("users").distinct("id) FROM users; --"))).toThrow(/Use raw\(\)/);
  expect(() =>
    sql(
      from("users")
        .update({ a: 1 })
        .returning("id; DROP TABLE users" as any),
    ),
  ).toThrow(/Use raw\(\)/);
  expect(sql(from("users").update({ a: 1 }).returning("*"))).toContain("RETURNING *");
});

test("select keeps developer expressions but rejects separators, comments, quotes, placeholders", () => {
  expect(sql(from("e").select("e.*", "COUNT(DISTINCT a.visitor) as people", "u.name as author_name"))).toBe(
    "SELECT e.*, COUNT(DISTINCT a.visitor) as people, u.name as author_name FROM e",
  );
  expect(sql(from("p").select("(select count(*) from likes where likes.postId = p.id) as likeCount"))).toContain(
    "likeCount",
  );
  for (const bad of ["id; DROP TABLE users", "id -- x", "id /* x */", "'a' as b", "$1 as b", "id\u0000"]) {
    expect(() => sql(from("users").select(bad))).toThrow(/Unsafe select expression/);
  }
});

test("raw() is still the escape hatch for expressions", () => {
  expect(sql(from("users").orderBy(raw("lower(email)"), "DESC"))).toBe(
    "SELECT * FROM users ORDER BY lower(email) DESC",
  );
});
