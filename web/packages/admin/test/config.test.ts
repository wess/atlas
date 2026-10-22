import { expect, test } from "bun:test";
import { column, connect, defineSchema } from "../../db/index.ts";
import { get, json, pipe } from "../../server/index.ts";
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
  const result = admin({ allowUnauthenticated: true, db, models: [model({ schema: users })] });
  expect(result.routes).toBeDefined();
  expect(Array.isArray(result.routes)).toBe(true);
  expect(typeof result.mount).toBe("function");
});

test("admin mount merges routes", () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  const result = admin({ allowUnauthenticated: true, db, models: [model({ schema: users })] });
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
  const result = admin({ allowUnauthenticated: true, db, models: [model({ schema: users })], basePath: "/panel" });
  expect(result.routes.some((r) => r.pattern === "/panel/api/schema")).toBe(true);
  expect(result.routes.some((r) => r.pattern === "/panel/api/users")).toBe(true);
});

test("admin APIs distinguish authentication from administrator authorization", async () => {
  const { token } = await import("../../auth/index.ts");
  const { router } = await import("../../server/index.ts");
  const db = connect({ driver: "sqlite", path: ":memory:" });
  const panel = admin({
    allowUnauthenticated: true,
    db,
    models: [model({ schema: users })],
    auth: { secret: "test", authorize: (claims) => claims.role === "admin" },
  });
  const app = router(...panel.routes);
  try {
    for (const [role, status] of [
      ["user", 403],
      ["admin", 200],
    ] as const) {
      const jwt = await token.sign({ role }, "test");
      expect(
        (await app(new Request("http://localhost/admin/api/schema", { headers: { authorization: `Bearer ${jwt}` } })))
          .status,
      ).toBe(status);
    }
    expect((await app(new Request("http://localhost/admin/api/schema"))).status).toBe(401);
  } finally {
    await db.close();
  }
});

test("admin routes require authentication by default", () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  expect(() => admin({ db, models: [] })).toThrow("require authentication");
  void db.close();
});
