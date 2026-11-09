import { expect, test } from "bun:test";
import { createHash, randomBytes } from "node:crypto";
import { requireAuth } from "../../auth/flows/index.ts";
import * as jwt from "../../auth/token/index.ts";
import { type Connection, connect } from "../../db/index.ts";
import { assign, createConn, type PipeFn, router } from "../../server/index.ts";
import { oauthRoutes } from "..";
import type { OAuthConfig } from "../types";

// the oauth AGENTS.md quick start used to share one secret between the OAuth server and requireAuth
const SECRET = "shared-secret";

const schema = async (db: Connection) => {
  for (const text of [
    `CREATE TABLE oauth_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT UNIQUE NOT NULL, client_secret_hash TEXT,
      name TEXT NOT NULL, description TEXT, icon_url TEXT, redirect_uris TEXT NOT NULL,
      allowed_scopes TEXT NOT NULL, is_official INTEGER NOT NULL DEFAULT 0, created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')), revoked_at TEXT,
      backchannel_logout_uri TEXT, post_logout_redirect_uris TEXT)`,
    `CREATE TABLE oauth_authorization_codes (
      code TEXT PRIMARY KEY, client_id TEXT NOT NULL, user_id INTEGER NOT NULL, redirect_uri TEXT NOT NULL,
      code_challenge TEXT NOT NULL, code_challenge_method TEXT NOT NULL, scope TEXT NOT NULL,
      expires_at TEXT NOT NULL, used_at TEXT, nonce TEXT, auth_time INTEGER)`,
    `CREATE TABLE oauth_refresh_tokens (
      token_hash TEXT PRIMARY KEY, client_id TEXT NOT NULL, user_id INTEGER NOT NULL, scope TEXT NOT NULL,
      parent_token_hash TEXT, created_at TEXT DEFAULT (datetime('now')), expires_at TEXT NOT NULL, revoked_at TEXT)`,
    `CREATE TABLE oauth_device_codes (
      device_code TEXT PRIMARY KEY, user_code TEXT UNIQUE NOT NULL, client_id TEXT NOT NULL, scope TEXT NOT NULL,
      user_id INTEGER, approved_at TEXT, denied_at TEXT, last_polled_at TEXT, expires_at TEXT NOT NULL)`,
  ]) {
    await db.execute({ text, values: [] });
  }
};

const signedIn: PipeFn = (conn) => assign(conn, { auth: { id: 1 } });

const b64url = (buf: Buffer) => buf.toString("base64url");

const setup = async (extra: Partial<OAuthConfig> = {}) => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  await schema(db);
  const keys = await jwt.generateRs256KeyPair();
  const ended: Record<string, unknown>[] = [];
  const cfg: OAuthConfig = {
    db,
    secret: SECRET,
    scopes: ["openid", "read", "write"],
    loadUser: async (_db, id) => ({ id, email: `u${id}@test` }),
    buildAccessTokenClaims: (user) => ({ id: user.id, email: user.email }),
    requireUser: signedIn,
    requireAdmin: signedIn,
    openid: {
      signingKey: keys,
      jwks: async () => ({ keys: [keys.publicJwk] }),
      buildIdTokenClaims: (user) => ({ sub: String(user.id), email: user.email }),
      onEndSession: (params) => {
        ended.push(params);
      },
    },
    ...extra,
  };
  const app = router(...oauthRoutes(cfg));
  const call = async (path: string, body?: Record<string, unknown>, headers: Record<string, string> = {}) => {
    const res = await app(
      new Request(`http://localhost${path}`, {
        method: body ? "POST" : "GET",
        headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
    return { status: res.status, headers: res.headers, body: (await res.json().catch(() => null)) as any };
  };

  const client = async (confidential = false) => {
    const made = await call("/admin/oauth/clients", {
      name: "App",
      redirect_uris: ["https://rp.test/cb"],
      allowed_scopes: ["read", "openid"],
      is_public_client: !confidential,
    });
    await db.execute({
      text: "UPDATE oauth_clients SET backchannel_logout_uri = ?, post_logout_redirect_uris = ? WHERE client_id = ?",
      values: ["https://rp.test/logout", JSON.stringify(["https://rp.test/bye"]), made.body.client_id],
    });
    return { id: made.body.client_id as string, secret: made.body.client_secret as string | undefined };
  };

  const authorize = async (c: { id: string; secret?: string }, scope = "read") => {
    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash("sha256").update(verifier).digest());
    const approved = await call("/oauth/authorize/approve", {
      response_type: "code",
      client_id: c.id,
      redirect_uri: "https://rp.test/cb",
      scope,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    const code = new URL(approved.body.redirect_url).searchParams.get("code")!;
    const exchange = () =>
      call("/oauth/token", {
        grant_type: "authorization_code",
        client_id: c.id,
        client_secret: c.secret,
        code,
        code_verifier: verifier,
        redirect_uri: "https://rp.test/cb",
      });
    return { exchange };
  };

  return { db, call, client, authorize, ended };
};

test("an OAuth access token is typed at+jwt and can't pass requireAuth as the user", async () => {
  const { client, authorize } = await setup();
  const tokens = (await (await authorize(await client())).exchange()).body;
  expect(jwt.headerOf(tokens.access_token).typ).toBe("at+jwt");
  const conn = createConn(
    new Request("http://localhost/me", { headers: { authorization: `Bearer ${tokens.access_token}` } }),
  );
  expect((await requireAuth({ secret: SECRET })(conn)).status).toBe(401);
  expect((await requireAuth({ secret: SECRET, acceptAccessTokens: true })(conn)).halted).toBe(false);
});

test("userinfo takes only access tokens and hides verification errors", async () => {
  const { call, client, authorize } = await setup();
  const tokens = (await (await authorize(await client(), "openid read")).exchange()).body;
  const ok = await call("/oauth/userinfo", undefined, { authorization: `Bearer ${tokens.access_token}` });
  expect(ok.status).toBe(200);
  expect(ok.body.sub).toBe("1");

  const session = await jwt.sign({ id: 1, sub: "1", scope: "openid" }, SECRET, { expiresIn: 60 });
  const refused = await call("/oauth/userinfo", undefined, { authorization: `Bearer ${session}` });
  expect(refused.status).toBe(401);
  const bad = await call("/oauth/userinfo", undefined, { authorization: "Bearer a.b.c" });
  expect(bad.body.error_description).toBe("Invalid or expired access token");
});

test("revoking a confidential client's refresh token requires its credentials", async () => {
  const { db, call, client, authorize } = await setup();
  const c = await client(true);
  const tokens = (await (await authorize(c)).exchange()).body;
  const revoked = async () =>
    (
      (await db.one({ text: "SELECT revoked_at FROM oauth_refresh_tokens", values: [] })) as {
        revoked_at: string | null;
      }
    ).revoked_at;

  expect((await call("/oauth/revoke", { token: tokens.refresh_token })).status).toBe(401);
  expect((await call("/oauth/revoke", { token: tokens.refresh_token, client_id: c.id })).status).toBe(401);
  const other = await client(true);
  expect(
    (await call("/oauth/revoke", { token: tokens.refresh_token, client_id: other.id, client_secret: other.secret }))
      .status,
  ).toBe(400);
  expect(await revoked()).toBeNull();

  const done = await call("/oauth/revoke", { token: tokens.refresh_token, client_id: c.id, client_secret: c.secret });
  expect(done.status).toBe(200);
  expect(await revoked()).not.toBeNull();
});

test("a public client's token can still be revoked by its holder", async () => {
  const { call, client, authorize } = await setup();
  const tokens = (await (await authorize(await client())).exchange()).body;
  expect((await call("/oauth/revoke", { token: tokens.refresh_token })).status).toBe(200);
  expect((await call("/oauth/revoke", { token: "oat_unknown" })).status).toBe(200);
});

test("replaying a used authorization code revokes the refresh tokens it led to", async () => {
  const { call, client, authorize } = await setup();
  const c = await client();
  const flow = await authorize(c);
  const first = await flow.exchange();
  expect(first.status).toBe(200);
  expect((await flow.exchange()).status).toBe(400);
  const refreshed = await call("/oauth/token", {
    grant_type: "refresh_token",
    client_id: c.id,
    refresh_token: first.body.refresh_token,
  });
  expect(refreshed.status).toBe(400);
  expect(refreshed.body.error).toBe("invalid_grant");
});

test("end_session needs a hint for this client and tells onEndSession which client to notify", async () => {
  const { call, client, authorize, ended } = await setup();
  const c = await client();
  const tokens = (await (await authorize(c, "openid read")).exchange()).body;
  expect(tokens.id_token).toBeTruthy();

  // no hint: a cross-site GET ends nothing
  expect((await call(`/oauth/end_session?client_id=${c.id}`)).status).toBe(200);
  expect(ended).toHaveLength(0);
  // a hint issued to another client doesn't count for this one
  await call(`/oauth/end_session?client_id=cli_other&id_token_hint=${tokens.id_token}`);
  expect(ended).toHaveLength(0);

  const done = await call(
    `/oauth/end_session?client_id=${c.id}&id_token_hint=${tokens.id_token}&post_logout_redirect_uri=${encodeURIComponent("https://rp.test/bye")}`,
  );
  expect(done.status).toBe(302);
  expect(ended).toHaveLength(1);
  expect(ended[0]).toMatchObject({ clientId: c.id, backchannelLogoutUri: "https://rp.test/logout", userId: "1" });
});

test("a configured issuer wins over the Host header", async () => {
  const { call, client, authorize } = await setup({ issuer: "https://id.example.com/" });
  const meta = await call("/.well-known/openid-configuration", undefined, { host: "evil.example" });
  expect(meta.body.issuer).toBe("https://id.example.com");
  expect(meta.body.token_endpoint).toBe("https://id.example.com/oauth/token");
  const tokens = (await (await authorize(await client(), "openid read")).exchange()).body;
  const [, payload] = tokens.id_token.split(".");
  expect(JSON.parse(Buffer.from(payload, "base64url").toString()).iss).toBe("https://id.example.com");
});
