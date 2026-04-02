import { expect, test } from "bun:test";
import { column, connect, defineSchema } from "@atlas/db";
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
  expect(typeof result.mount).toBe("function");
});

test("admin mount merges routes", () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  const result = admin({ db, models: [model({ schema: users })] });
  const existing = { "GET /health": (() => {}) as any };
  const merged = result.mount(existing);
  expect(merged["GET /health"]).toBeDefined();
  expect(merged["GET /admin/api/schema"]).toBeDefined();
});

test("admin uses custom basePath", () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  const result = admin({ db, models: [model({ schema: users })], basePath: "/panel" });
  expect(result.routes["GET /panel/api/schema"]).toBeDefined();
  expect(result.routes["GET /panel/api/users"]).toBeDefined();
});
