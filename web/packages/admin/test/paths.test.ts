import { expect, test } from "bun:test";
import { hrefFor, parseRoute, paths } from "../ui/paths.ts";

const base = "/admin";
const at = (path: string) => parseRoute(hrefFor(base, path), base);

test("every screen round-trips through its path", () => {
  expect(at(paths.dashboard)).toEqual({ name: "dashboard" });
  expect(at(paths.query)).toEqual({ name: "query" });
  expect(at(paths.login)).toEqual({ name: "login" });
  expect(at(paths.list("users"))).toEqual({ name: "list", table: "users" });
  expect(at(paths.create("users"))).toEqual({ name: "create", table: "users" });
  expect(at(paths.detail("users", 5))).toEqual({ name: "detail", table: "users", id: "5" });
});

test("tables and records named like screens do not collide", () => {
  expect(at(paths.list("query"))).toEqual({ name: "list", table: "query" });
  expect(at(paths.list("assets"))).toEqual({ name: "list", table: "assets" });
  expect(at(paths.detail("users", "new"))).toEqual({ name: "detail", table: "users", id: "new" });
});

test("awkward ids survive encoding", () => {
  expect(at(paths.detail("users", "a/b c?d#e"))).toEqual({ name: "detail", table: "users", id: "a/b c?d#e" });
});

test("a trailing slash is the same screen", () => {
  expect(parseRoute("/admin/", base)).toEqual({ name: "dashboard" });
  expect(parseRoute("/admin/models/users/", base)).toEqual({ name: "list", table: "users" });
});

test("unknown shapes and bad encoding are not found", () => {
  for (const path of [
    "/admin/nope",
    "/admin/models",
    "/admin/models/users/edit",
    "/admin/models/users/records",
    "/admin/models/users/records/1/x",
    "/admin/query/x",
    "/admin/models/%E0%A4%A",
    "/other",
    "/adminish",
  ]) {
    expect(parseRoute(path, base)).toEqual({ name: "notfound" });
  }
});

test("a custom or empty base path works", () => {
  expect(parseRoute("/panel/query", "/panel")).toEqual({ name: "query" });
  expect(hrefFor("", "")).toBe("/");
  expect(parseRoute("/query", "")).toEqual({ name: "query" });
});
