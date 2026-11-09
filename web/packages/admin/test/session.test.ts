import { afterEach, beforeAll, expect, test } from "bun:test";
import { sign } from "../../auth/token/index.ts";
import type { Connection } from "../../db/index.ts";
import { column, connect, defineSchema } from "../../db/index.ts";
import { parseTrustedProxies } from "../../security/ratelimit/index.ts";
import { router } from "../../server/index.ts";
import { type AdminConfig, admin, model } from "../config/index.ts";
import { createDbRevocations, createMemoryRevocations } from "../revocations/index.ts";

const users = defineSchema("users", { id: column.serial().primaryKey(), email: column.text() });
const secret = "a-test-secret-that-is-long-enough-for-hmac";
const origin = "http://admin.test";

let db: Connection;
beforeAll(() => {
  db = connect({ driver: "sqlite", path: ":memory:" });
});

const auth = (extra: Partial<NonNullable<AdminConfig["auth"]>> = {}): NonNullable<AdminConfig["auth"]> => ({
  secret,
  authorize: (claims) => claims.role === "admin",
  login: ({ email, password }) => {
    if (password !== "right") return null;
    return { role: email.startsWith("admin") ? "admin" : "user" };
  },
  ...extra,
});
const appWith = (config: NonNullable<AdminConfig["auth"]>) =>
  router(...admin({ db, models: [model({ schema: users })], auth: config }).routes);

type Options = { method?: string; body?: unknown; cookie?: string; from?: string | null; bearer?: string };
const send = (app: (req: Request) => Promise<Response>, path: string, options: Options = {}) => {
  const headers: Record<string, string> = { host: "admin.test" };
  if (options.body) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.from !== null) headers.origin = options.from ?? origin;
  if (options.bearer) headers.authorization = `Bearer ${options.bearer}`;
  return app(
    new Request(`${origin}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }),
  );
};
const login = (
  app: (req: Request) => Promise<Response>,
  email = "admin@x.co",
  password = "right",
  from?: string | null,
) => send(app, "/admin/session", { method: "POST", body: { email, password }, from });
const cookieOf = (response: Response) => response.headers.get("set-cookie")!.split(";")[0]!;

const nodeEnv = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = nodeEnv;
});

test("signing in sets a locked-down cookie that opens the api", async () => {
  const app = appWith(auth());
  const response = await login(app);
  expect(response.status).toBe(200);
  const header = response.headers.get("set-cookie")!;
  for (const attribute of ["HttpOnly", "SameSite=Strict", "Path=/admin", "Max-Age=28800"]) {
    expect(header).toContain(attribute);
  }
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect((await response.json()).token).toBeUndefined();
  expect((await send(app, "/admin/api/schema", { cookie: cookieOf(response) })).status).toBe(200);
});

test("the cookie is Secure in production only", async () => {
  expect((await login(appWith(auth()))).headers.get("set-cookie")).not.toContain("Secure");
  process.env.NODE_ENV = "production";
  expect((await login(appWith(auth()))).headers.get("set-cookie")).toContain("Secure");
});

test("session length and path follow the config", async () => {
  const config = auth({ sessionSeconds: 60 });
  const app = router(...admin({ db, basePath: "/panel", models: [model({ schema: users })], auth: config }).routes);
  const response = await send(app, "/panel/session", { method: "POST", body: { email: "admin@x", password: "right" } });
  expect(response.headers.get("set-cookie")).toContain("Max-Age=60");
  expect(response.headers.get("set-cookie")).toContain("Path=/panel");
});

test("a wrong password gets no cookie", async () => {
  const response = await login(appWith(auth()), "admin@x.co", "wrong");
  expect(response.status).toBe(401);
  expect(response.headers.get("set-cookie")).toBeNull();
});

test("valid credentials without admin rights get no cookie", async () => {
  const response = await login(appWith(auth()), "someone@x.co");
  expect(response.status).toBe(403);
  expect(response.headers.get("set-cookie")).toBeNull();
});

test("malformed or oversized credentials stop before login runs", async () => {
  let calls = 0;
  const app = appWith(
    auth({
      login: () => {
        calls += 1;
        return null;
      },
    }),
  );
  for (const body of [{}, { email: "a" }, { email: 1, password: 2 }, { email: "a", password: "x".repeat(1025) }]) {
    expect((await send(app, "/admin/session", { method: "POST", body })).status).toBe(400);
  }
  expect(calls).toBe(0);
});

const from = (ip: string) => ({ headers: { "x-forwarded-for": ip } });
const loginFrom = (app: (req: Request) => Promise<Response>, ip: string, email: string, password: string) =>
  app(
    Object.assign(
      new Request(`${origin}/admin/session`, {
        method: "POST",
        headers: { host: "admin.test", origin, "content-type": "application/json", ...from(ip).headers },
        body: JSON.stringify({ email, password }),
      }),
      { peerIp: "10.0.0.1" },
    ),
  );

test("failures throttle one address on one account, without locking that account out elsewhere", async () => {
  let calls = 0;
  const base = auth();
  const app = appWith(
    auth({
      trustedProxies: parseTrustedProxies("10.0.0.1"),
      login: (credentials) => {
        calls += 1;
        return base.login!(credentials);
      },
    }),
  );
  for (let attempt = 0; attempt < 10; attempt++) {
    expect((await loginFrom(app, "203.0.113.9", "admin@x.co", "wrong")).status).toBe(401);
  }
  const blocked = await loginFrom(app, "203.0.113.9", " ADMIN@x.co", "right");
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get("retry-after")).toBeTruthy();
  expect(calls).toBe(10);
  expect((await loginFrom(app, "198.51.100.4", "admin@x.co", "right")).status).toBe(200);
});

test("one address spraying many accounts is throttled", async () => {
  const app = appWith(auth({ trustedProxies: parseTrustedProxies("10.0.0.1") }));
  for (let attempt = 0; attempt < 50; attempt++) {
    await loginFrom(app, "203.0.113.20", `admin${attempt}@x.co`, "wrong");
  }
  expect((await loginFrom(app, "203.0.113.20", "admin-new@x.co", "right")).status).toBe(429);
  expect((await loginFrom(app, "203.0.113.21", "admin-new@x.co", "right")).status).toBe(200);
});

test("X-Forwarded-For is ignored unless the peer is a trusted proxy", async () => {
  const app = appWith(auth());
  for (let attempt = 0; attempt < 10; attempt++) {
    await loginFrom(app, `203.0.113.${attempt}`, "admin@x.co", "wrong");
  }
  expect((await loginFrom(app, "203.0.113.99", "admin@x.co", "right")).status).toBe(429);
});

test("a success clears that address's count for the account", async () => {
  const app = appWith(auth());
  for (let attempt = 0; attempt < 9; attempt++) await login(app, "admin3@x.co", "wrong");
  expect((await login(app, "admin3@x.co", "right")).status).toBe(200);
  for (let attempt = 0; attempt < 9; attempt++) expect((await login(app, "admin3@x.co", "wrong")).status).toBe(401);
});

test("signing out revokes the session, so a copied cookie stops working", async () => {
  const app = appWith(auth());
  const cookie = cookieOf(await login(app));
  expect((await send(app, "/admin/api/schema", { cookie })).status).toBe(200);
  expect((await send(app, "/admin/session", { method: "DELETE", cookie })).status).toBe(200);
  expect((await send(app, "/admin/api/schema", { cookie })).status).toBe(401);
  expect(await (await send(app, "/admin/session", { cookie })).json()).toMatchObject({ authenticated: false });
  const fresh = cookieOf(await login(app));
  expect(fresh).not.toBe(cookie);
  expect((await send(app, "/admin/api/schema", { cookie: fresh })).status).toBe(200);
});

test("a signed cookie without a session id is not a session", async () => {
  const app = appWith(auth());
  const bare = await sign({ role: "admin" }, secret, { expiresIn: 60 });
  expect((await send(app, "/admin/api/schema", { cookie: `atlas_admin_session=${bare}` })).status).toBe(401);
});

test("database revocations are shared between admin instances and survive a new process", async () => {
  const shared = createDbRevocations({ db });
  const first = appWith(auth({ revocations: shared }));
  const second = appWith(auth({ revocations: createDbRevocations({ db }) }));
  const cookie = cookieOf(await login(first));
  expect((await send(second, "/admin/api/schema", { cookie })).status).toBe(200);
  await send(first, "/admin/session", { method: "DELETE", cookie });
  expect((await send(second, "/admin/api/schema", { cookie })).status).toBe(401);
});

test("revocation stores forget entries once they expire, and reject unsafe table names", async () => {
  const memory = createMemoryRevocations();
  await memory.revoke("old", Math.floor(Date.now() / 1000) - 1);
  await memory.revoke("live", Math.floor(Date.now() / 1000) + 60);
  expect(await memory.isRevoked("old")).toBe(false);
  expect(await memory.isRevoked("live")).toBe(true);
  expect(() => createDbRevocations({ db, table: "x; drop table users" })).toThrow();
});

test("cross-origin sign-in is refused", async () => {
  const app = appWith(auth());
  expect((await login(app, "admin@x.co", "right", "https://evil.test")).status).toBe(403);
  expect((await login(app, "admin@x.co", "right", null)).status).toBe(403);
  expect((await login(app, "admin@x.co", "right", "not a url")).status).toBe(403);
});

test("a cookie cannot write from another origin, or with no origin, but can from its own", async () => {
  const app = appWith(auth());
  const cookie = cookieOf(await login(app));
  const write = (from?: string | null) =>
    send(app, "/admin/api/query/preview", { method: "POST", body: { table: "users" }, cookie, from });
  expect((await write("https://evil.test")).status).toBe(403);
  expect((await write(null)).status).toBe(403);
  expect((await write()).status).not.toBe(403);
});

test("trustedOrigins admits a proxy origin and nothing else", async () => {
  const app = appWith(auth({ trustedOrigins: ["https://admin.example.com"] }));
  expect((await login(app, "admin@x.co", "right", "https://admin.example.com")).status).toBe(200);
  expect((await login(app, "admin@x.co", "right", "https://other.example.com")).status).toBe(403);
});

test("bearer tokens keep working with no origin", async () => {
  const app = appWith(auth());
  const bearer = await sign({ role: "admin" }, secret);
  const response = await send(app, "/admin/api/query/preview", {
    method: "POST",
    body: { table: "users" },
    bearer,
    from: null,
  });
  expect(response.status).not.toBe(401);
  expect(response.status).not.toBe(403);
});

test("tampered, foreign and expired cookies do not authenticate", async () => {
  const app = appWith(auth());
  const good = cookieOf(await login(app));
  const foreign = await sign({ role: "admin" }, "another-secret-entirely-long-enough-here");
  const expired = await sign({ role: "admin" }, secret, { expiresIn: -10 });
  for (const value of [
    `${good}x`,
    `atlas_admin_session=${foreign}`,
    `atlas_admin_session=${expired}`,
    "atlas_admin_session=junk",
  ]) {
    expect((await send(app, "/admin/api/schema", { cookie: value })).status).toBe(401);
    expect(await (await send(app, "/admin/session", { cookie: value })).json()).toMatchObject({ authenticated: false });
  }
});

test("revoking admin rights takes effect on an existing cookie", async () => {
  let allowed = true;
  const app = appWith(auth({ authorize: () => allowed }));
  const cookie = cookieOf(await login(app));
  expect((await send(app, "/admin/api/schema", { cookie })).status).toBe(200);
  allowed = false;
  expect((await send(app, "/admin/api/schema", { cookie })).status).toBe(403);
  expect(await (await send(app, "/admin/session", { cookie })).json()).toMatchObject({ authenticated: false });
});

test("the session endpoint reports state without touching the api", async () => {
  const app = appWith(auth());
  expect(await (await send(app, "/admin/session")).json()).toEqual({
    authRequired: true,
    authenticated: false,
    loginEnabled: true,
  });
  const cookie = cookieOf(await login(app));
  expect(await (await send(app, "/admin/session", { cookie })).json()).toMatchObject({ authenticated: true });
  expect((await send(app, "/admin/api/schema")).status).toBe(401);
});

test("signing out clears the cookie, and only from our own origin", async () => {
  const app = appWith(auth());
  expect((await send(app, "/admin/session", { method: "DELETE", from: "https://evil.test" })).status).toBe(403);
  const response = await send(app, "/admin/session", { method: "DELETE" });
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
});

test("without login there is no sign-in route, and bearer still works", async () => {
  const { login: _unused, ...rest } = auth();
  const app = appWith(rest);
  expect(await (await send(app, "/admin/session")).json()).toMatchObject({ loginEnabled: false });
  expect((await send(app, "/admin/session", { method: "POST", body: { email: "a", password: "b" } })).status).not.toBe(
    200,
  );
  const bearer = await sign({ role: "admin" }, secret);
  expect((await send(app, "/admin/api/schema", { bearer })).status).toBe(200);
});

test("an unauthenticated dev admin reports that no sign-in is needed", async () => {
  const app = router(...admin({ db, allowUnauthenticated: true, models: [model({ schema: users })] }).routes);
  expect(await (await send(app, "/admin/session")).json()).toMatchObject({ authRequired: false });
});

test("a shared rate limiter can replace the per-process one", async () => {
  const calls: string[] = [];
  const rateLimit = {
    check: async (bucket: string) => {
      calls.push(bucket);
      return { ok: false, count: 99, retryAfterSeconds: 60 };
    },
    reset: async () => {},
    sweep: async () => 0,
  };
  const response = await login(appWith(auth({ rateLimit })));
  expect(response.status).toBe(429);
  expect(calls).toEqual(["admin-login:unknown:admin@x.co"]);
});
