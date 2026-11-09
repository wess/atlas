import { beforeEach, expect, test } from "bun:test";
import { ACCESS_TOKEN_TYP, sign } from "../../auth/token/index.ts";
import type { Connection } from "../../db/index.ts";
import { column, connect, defineSchema } from "../../db/index.ts";
import { parseTrustedProxies } from "../../security/ratelimit/index.ts";
import { router } from "../../server/index.ts";
import { admin, model } from "../config/index.ts";

const secret = "a-test-secret-that-is-long-enough-for-hmac";
const origin = "http://admin.test";

const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text(),
  name: column.text(),
});
const accounts = defineSchema("accounts", {
  id: column.serial().primaryKey(),
  email: column.text(),
  role: column.text(),
});

let db: Connection;
let app: (req: Request) => Promise<Response>;

beforeEach(async () => {
  db = connect({ driver: "sqlite", path: ":memory:" });
  // is_admin exists in the table but not in the schema the admin was given
  await db.execute({
    text: "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, name TEXT, is_admin INTEGER DEFAULT 0)",
    values: [],
  });
  await db.execute({
    text: "CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, role TEXT)",
    values: [],
  });
  await db.execute({ text: "INSERT INTO users (email, name) VALUES ('a@x.co', 'A'), ('b@x.co', 'B')", values: [] });
  await db.execute({ text: "INSERT INTO accounts (email, role) VALUES ('c@x.co', 'user')", values: [] });
  app = router(
    ...admin({
      db,
      allowUnauthenticated: true,
      models: [
        model({
          schema: users,
          actions: [
            {
              name: "deactivate",
              label: "Deactivate",
              handler: async (_db, ids) => ({ message: `Deactivated ${ids.length}` }),
            },
          ],
        }),
        model({ schema: accounts, editableFields: ["email"] }),
      ],
    }).routes,
  );
});

const send = (path: string, method: string, body: unknown) =>
  app(
    new Request(`${origin}/admin/api/${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const row = (sql: string) => db.one<Record<string, unknown>>({ text: sql, values: [] });

test("create and update drop columns outside the schema and never touch the primary key", async () => {
  const created = await send("users", "POST", { email: "n@x.co", name: "N", is_admin: 1, id: 999 });
  expect(created.status).toBe(201);
  const made = (await created.json()).data;
  expect(made.id).not.toBe(999);
  expect(made.is_admin).toBe(0);

  expect((await send("users/1", "PUT", { name: "Renamed", is_admin: 1, id: 50 })).status).toBe(200);
  expect(await row("SELECT id, name, is_admin FROM users WHERE id = 1")).toEqual({
    id: 1,
    name: "Renamed",
    is_admin: 0,
  });
  expect(await row("SELECT id FROM users WHERE id = 50")).toBeNull();
});

test("editableFields limits writes further", async () => {
  expect((await send("accounts/1", "PUT", { email: "new@x.co", role: "admin" })).status).toBe(200);
  expect(await row("SELECT email, role FROM accounts WHERE id = 1")).toEqual({ email: "new@x.co", role: "user" });
  expect((await send("accounts/1", "PUT", { role: "admin" })).status).toBe(400);
});

test("a body that isn't an object is refused", async () => {
  expect((await send("users", "POST", ["x"])).status).toBe(400);
  expect((await send("users/1", "PUT", "x")).status).toBe(400);
});

test("bulk and custom actions refuse ids that aren't an array", async () => {
  // a string used to be iterated per character, deleting rows "1" and "2"
  const bulk = await send("users/bulk", "POST", { action: "delete", ids: "12" });
  expect(bulk.status).toBe(400);
  expect(await row("SELECT count(*) AS n FROM users")).toEqual({ n: 2 });
  expect((await send("users/bulk", "POST", { action: "delete", ids: [{ id: 1 }] })).status).toBe(400);
  expect((await send("users/action", "POST", { action: "deactivate", ids: "12" })).status).toBe(400);
  expect((await send("users/action", "POST", { action: "deactivate", ids: [1, "2"] })).status).toBe(200);
  expect((await send("users/bulk", "POST", { action: "delete", ids: [1] })).status).toBe(200);
  expect(await row("SELECT count(*) AS n FROM users")).toEqual({ n: 1 });
});

const securedApp = (trustedProxies?: string) =>
  router(
    ...admin({
      db,
      models: [model({ schema: users })],
      auth: {
        secret,
        authorize: (claims) => claims.role === "admin",
        login: ({ password }) => (password === "right" ? { role: "admin" } : null),
        ...(trustedProxies ? { trustedProxies: parseTrustedProxies(trustedProxies) } : {}),
      },
    }).routes,
  );

test("an OAuth access token signed with the admin secret opens neither bearer nor cookie auth", async () => {
  const secured = securedApp();
  const accessToken = await sign({ role: "admin", client_id: "cli_x", scope: "read", jti: "j" }, secret, {
    expiresIn: 3600,
    typ: ACCESS_TOKEN_TYP,
  });
  const get = (headers: Record<string, string>) =>
    secured(new Request(`${origin}/admin/api/schema`, { headers: { host: "admin.test", ...headers } }));
  expect((await get({ authorization: `Bearer ${accessToken}` })).status).toBe(401);
  expect((await get({ cookie: `atlas_admin_session=${accessToken}` })).status).toBe(401);
  const reset = await sign({ role: "admin", purpose: "password_reset", jti: "r" }, secret, { expiresIn: 3600 });
  expect((await get({ authorization: `Bearer ${reset}` })).status).toBe(401);
  expect((await get({ cookie: `atlas_admin_session=${reset}` })).status).toBe(401);
  const session = await sign({ role: "admin" }, secret, { expiresIn: 3600 });
  expect((await get({ authorization: `Bearer ${session}` })).status).toBe(200);
});

test("login throttling counts an IPv6 /64 as one address", async () => {
  const secured = securedApp("10.0.0.1");
  const attempt = (ip: string, password: string) =>
    secured(
      Object.assign(
        new Request(`${origin}/admin/session`, {
          method: "POST",
          headers: { host: "admin.test", origin, "content-type": "application/json", "x-forwarded-for": ip },
          body: JSON.stringify({ email: "admin@x.co", password }),
        }),
        { peerIp: "10.0.0.1" },
      ),
    );
  // rotating the interface id inside one /64 used to give every attempt a fresh bucket
  for (let i = 0; i < 10; i++) expect((await attempt(`2001:db8:5:6::${i + 1}`, "wrong")).status).toBe(401);
  expect((await attempt("2001:db8:5:6:dead:beef::1", "right")).status).toBe(429);
  expect((await attempt("2001:db8:5:7::1", "right")).status).toBe(200);
});
