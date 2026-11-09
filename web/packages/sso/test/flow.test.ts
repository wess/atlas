import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import * as jwt from "../../auth/token/index.ts";
import { connect } from "../../db/index.ts";
import { router } from "../../server/index.ts";
import { clearDiscoveryCache, mountSso } from "../index.ts";
import { ensureSsoStateTable } from "../migrate.ts";

let keys: jwt.Rs256KeyPair;
let issuer: ReturnType<typeof Bun.serve>;
let origin: string;
let discoveryRequests = 0;

beforeAll(async () => {
  keys = await jwt.generateRs256KeyPair();
  issuer = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname.endsWith("openid-configuration")) {
        discoveryRequests++;
        return Response.json({
          issuer: origin,
          authorization_endpoint: `${origin}/authorize`,
          token_endpoint: `${origin}/token`,
          jwks_uri: `${origin}/keys`,
        });
      }
      if (url.pathname === "/keys") return Response.json({ keys: [keys.publicJwk] });
      if (url.pathname === "/token") {
        const form = await req.formData();
        const idToken = await jwt.signRs256(
          { sub: "user", iss: origin, aud: "client", nonce: form.get("code") },
          keys,
          { expiresIn: 60 },
        );
        return Response.json({ id_token: idToken });
      }
      return new Response(null, { status: 404 });
    },
  });
  origin = issuer.url.origin;
});

afterAll(() => {
  issuer.stop(true);
  clearDiscoveryCache();
});

const setup = async (provision?: () => Promise<{ localUserId: number }>) => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  await ensureSsoStateTable(db);
  let logouts = 0;
  let logins = 0;
  const app = router(
    ...mountSso({
      db,
      issuerUrl: origin,
      clientId: "client",
      clientSecret: "secret",
      onAuthenticated: async () => {
        logins++;
        return provision ? provision() : { localUserId: 1 };
      },
      issueSession: (conn) => conn,
      invalidateSessions: () => {
        logouts++;
      },
    }),
  );
  return { db, app, logouts: () => logouts, logins: () => logins };
};

test("SSO binds state to the browser, consumes it once, and confines return URLs", async () => {
  const { db, app, logins } = await setup();
  try {
    const start = await app(new Request("http://localhost/auth/sso/login?return_to=https://evil.test"));
    expect(start.status).toBe(302);
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const cookie = start.headers.get("set-cookie")!.split(";")[0]!;
    const row = await db.one<{ nonce: string }>({
      text: "SELECT nonce FROM sso_state WHERE state = ?",
      values: [state],
    });
    const callback = `http://localhost/auth/sso/callback?code=${row!.nonce}&state=${state}`;
    expect((await app(new Request(callback))).status).toBe(400);
    expect(logins()).toBe(0);
    const success = await app(new Request(callback, { headers: { cookie } }));
    expect(success.status).toBe(302);
    expect(success.headers.get("location")).toBe("/");
    expect(success.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(logins()).toBe(1);
    expect((await app(new Request(callback, { headers: { cookie } }))).status).toBe(400);
  } finally {
    await db.close();
  }
});

test("logout rejects other audiences, issuers, stale tokens and replays", async () => {
  const { db, app, logouts } = await setup();
  const claims = {
    sub: "user",
    iss: origin,
    aud: "client",
    jti: "logout-1",
    events: { "http://schemas.openid.net/event/backchannel-logout": {} },
  };
  const logout = async (token: string) =>
    app(
      new Request("http://localhost/auth/sso/backchannel-logout", {
        method: "POST",
        body: new URLSearchParams({ logout_token: token }),
      }),
    );
  try {
    for (const bad of [{ aud: "other-client" }, { iss: "https://evil.test" }, { nonce: "unexpected" }]) {
      expect((await logout(await jwt.signRs256({ ...claims, ...bad }, keys, { expiresIn: 60 }))).status).toBe(400);
    }
    expect(logouts()).toBe(0);
    const valid = await jwt.signRs256(claims, keys, { expiresIn: 60 });
    expect((await logout(valid)).status).toBe(200);
    expect((await logout(valid)).status).toBe(400);
    expect(logouts()).toBe(1);
  } finally {
    await db.close();
  }
});

test("concurrent logins share one discovery request", async () => {
  const { db, app } = await setup();
  clearDiscoveryCache();
  const before = discoveryRequests;
  try {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => app(new Request("http://localhost/auth/sso/login"))),
    );
    expect(responses.every((res) => res.status === 302)).toBe(true);
    expect(discoveryRequests - before).toBe(1);
  } finally {
    await db.close();
  }
});

const signIn = async (
  app: (req: Request) => Promise<Response>,
  db: Awaited<ReturnType<typeof setup>>["db"],
  query: string,
) => {
  const start = await app(new Request(`http://localhost/auth/sso/login${query}`));
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const cookie = start.headers.get("set-cookie")!.split(";")[0]!;
  const row = await db.one<{ nonce: string }>({ text: "SELECT nonce FROM sso_state WHERE state = ?", values: [state] });
  return app(
    new Request(`http://localhost/auth/sso/callback?code=${row!.nonce}&state=${state}`, { headers: { cookie } }),
  );
};

test("return_to with a tab, newline, or backslash can't leave the site", async () => {
  const { db, app } = await setup();
  try {
    // browsers strip the tab, so "/\t/evil.example" would become "//evil.example"
    for (const evil of ["/%09/evil.example", "/%0A/evil.example", "/%5Cevil.example", "/%00/evil.example"]) {
      const done = await signIn(app, db, `?return_to=${evil}`);
      expect(done.status).toBe(302);
      expect(done.headers.get("location")).toBe("/");
    }
    expect((await signIn(app, db, "?return_to=/inbox%3Ftab%3D2")).headers.get("location")).toBe("/inbox?tab=2");
  } finally {
    await db.close();
  }
});

test("a provisioning failure is logged, not shown to the browser", async () => {
  const logged = spyOn(console, "error").mockImplementation(() => {});
  const { db, app } = await setup(async () => {
    throw new Error("duplicate key value violates unique constraint users_email_key");
  });
  try {
    const done = await signIn(app, db, "");
    expect(done.status).toBe(500);
    const body = await done.text();
    expect(body).toContain("provisioning_failed");
    expect(body).not.toContain("users_email_key");
    expect(logged.mock.calls.flat().join(" ")).toContain("users_email_key");
  } finally {
    logged.mockRestore();
    await db.close();
  }
});
