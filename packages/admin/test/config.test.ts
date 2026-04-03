import { expect, test } from "bun:test";
import { column, connect, defineSchema } from "@atlas/db";
import { get, pipe } from "@atlas/server";
import { json } from "@atlas/server";
import { admin, model } from "../config/index.ts";

const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  name: column.text(),
});

test("model creates a model config", () => {
  const cfg = model({ schema: users, listFields: ["id", "email"] });
  expect(cfg.schema.table).toBe("users");
  expect(cfg.listFields).toEqual(["id", "email"]);
});

test("model preserves all options", () => {
  const cfg = model({
    schema: users,
    searchFields: ["email"],
    filterFields: ["name"],
    readOnly: true,
    bulkActions: ["export"],
  });
  expect(cfg.searchFields).toEqual(["email"]);
  expect(cfg.filterFields).toEqual(["name"]);
  expect(cfg.readOnly).toBe(true);
  expect(cfg.bulkActions).toEqual(["export"]);
});

test("admin returns routes and mount", () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  const result = admin({ db, models: [model({ schema: users })] });
  expect(result.routes).toBeDefined();
  expect(Array.isArray(result.routes)).toBe(true);
  expect(typeof result.mount).toBe("function");
});

test("admin mount merges routes", () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  const result = admin({ db, models: [model({ schema: users })] });
  const existing = [
    get(
      "/health",
      pipe((c) => json(c, 200, { ok: true })),
    ),
  ];
  const merged = result.mount(existing);
  expect(Array.isArray(merged)).toBe(true);
  expect(merged.some((r) => r.pattern === "/health")).toBe(true);
  expect(merged.some((r) => r.pattern === "/admin/api/schema")).toBe(true);
});

test("admin uses custom basePath", () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  const result = admin({ db, models: [model({ schema: users })], basePath: "/panel" });
  expect(result.routes.some((r) => r.pattern === "/panel/api/schema")).toBe(true);
  expect(result.routes.some((r) => r.pattern === "/panel/api/users")).toBe(true);
});
