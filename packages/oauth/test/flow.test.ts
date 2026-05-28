import { beforeEach, expect, test } from "bun:test";
import { createHash, randomBytes } from "node:crypto";
import { type Connection, connect } from "../../db/index.ts";
import { assign, type PipeFn, router } from "../../server/index.ts";
import { oauthRoutes } from "..";
import type { OAuthConfig } from "../types";

const SECRET = "test-secret";

const setupSchema = async (db: Connection) => {
  // The library uses snake_case columns; SQLite needs lowercase identifiers.
  await db.execute({
    text: `CREATE TABLE oauth_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT UNIQUE NOT NULL,
      client_secret_hash TEXT,
      name TEXT NOT NULL,
      description TEXT,
      icon_url TEXT,
      redirect_uris TEXT NOT NULL,
      allowed_scopes TEXT NOT NULL,
      is_official INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      revoked_at TEXT
    )`,
    values: [],
  });
  await db.execute({
    text: `CREATE TABLE oauth_authorization_codes (
      code TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      redirect_uri TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      code_challenge_method TEXT NOT NULL,
      scope TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      nonce TEXT,
      auth_time INTEGER
    )`,
    values: [],
  });
  await db.execute({
    text: `CREATE TABLE oauth_refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      scope TEXT NOT NULL,
      parent_token_hash TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    )`,
    values: [],
  });
  await db.execute({
    text: `CREATE TABLE oauth_device_codes (
      device_code TEXT PRIMARY KEY,
      user_code TEXT UNIQUE NOT NULL,
      client_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      user_id INTEGER,
      approved_at TEXT,
      denied_at TEXT,
      last_polled_at TEXT,
      expires_at TEXT NOT NULL
    )`,
    values: [],
  });
};

// Test fixture: a guard that pretends user 1 is signed in.
const fakeAuth =
  (userId: number): PipeFn =>
  (conn) =>
    assign(conn, { auth: { id: userId } });

const buildApp = async () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  await setupSchema(db);
  const cfg: OAuthConfig = {
    db,
    secret: SECRET,
    scopes: ["read", "write", "share"],
    loadUser: async (db, id) =>
      (await db.one({
        text: "SELECT 1 AS ok",
        values: [],
      }))
        ? { id, email: `u${id}@test`, username: `u${id}`, name: `User ${id}` }
        : null,
    buildAccessTokenClaims: (user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
    }),
    requireUser: fakeAuth(1),
    requireAdmin: fakeAuth(1),
  };
  const app = router(...oauthRoutes(cfg));
  return { db, cfg, app };
};

const b64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const pkcePair = () => {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
};

let app: (req: Request) => Promise<Response>;

beforeEach(async () => {
  ({ app } = await buildApp());
});

const j = async (res: Response) => (await res.json()) as any;

test("admin can create a public PKCE client and the secret field is omitted", async () => {
  const res = await app(
    new Request("http://localhost/admin/oauth/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Test app",
        redirect_uris: ["myapp://callback"],
        allowed_scopes: ["read", "write"],
      }),
    }),
  );
  expect(res.status).toBe(201);
  const body = await j(res);
  expect(body.client_id).toMatch(/^cli_/);
  expect(body.is_public_client).toBe(true);
  expect(body.client_secret).toBeUndefined();
});

test("admin can create a confidential client and gets the secret exactly once", async () => {
  const res = await app(
    new Request("http://localhost/admin/oauth/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Server app",
        redirect_uris: ["https://srv/cb"],
        allowed_scopes: ["read"],
        is_public_client: false,
      }),
    }),
  );
  const body = await j(res);
  expect(body.client_secret).toMatch(/^cs_/);

  // Listing should NOT include the plaintext secret again.
  const list = await j(await app(new Request("http://localhost/admin/oauth/clients")));
  expect(list[0].client_secret).toBeUndefined();
});

test("client creation rejects unknown scopes", async () => {
  const res = await app(
    new Request("http://localhost/admin/oauth/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Bad",
        redirect_uris: ["https://x"],
        allowed_scopes: ["nope"],
      }),
    }),
  );
  expect(res.status).toBe(422);
});

test("client creation rejects garbage redirect_uris", async () => {
  const res = await app(
    new Request("http://localhost/admin/oauth/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Bad",
        redirect_uris: ["not a uri"],
        allowed_scopes: ["read"],
      }),
    }),
  );
  expect(res.status).toBe(422);
});

test("authorize → token (auth code grant) issues access + refresh", async () => {
  const create = await j(
    await app(
      new Request("http://localhost/admin/oauth/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "App",
          redirect_uris: ["myapp://cb"],
          allowed_scopes: ["read", "write"],
        }),
      }),
    ),
  );
  const clientId: string = create.client_id;
  const { verifier, challenge } = pkcePair();

  // Step 1: validate / preview
  const info = await j(
    await app(
      new Request(
        `http://localhost/oauth/authorize/info?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent("myapp://cb")}&scope=read&state=xyz&code_challenge=${challenge}&code_challenge_method=S256`,
      ),
    ),
  );
  expect(info.client.client_id).toBe(clientId);
  expect(info.scopes).toEqual(["read"]);

  // Step 2: approve → returns redirect URL with ?code=
  const approveRes = await app(
    new Request("http://localhost/oauth/authorize/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        response_type: "code",
        client_id: clientId,
        redirect_uri: "myapp://cb",
        scope: "read",
        state: "xyz",
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    }),
  );
  const approve = await j(approveRes);
  const redirectUrl = new URL(approve.redirect_url);
  const code = redirectUrl.searchParams.get("code");
  expect(code).toBeTruthy();
  expect(redirectUrl.searchParams.get("state")).toBe("xyz");

  // Step 3: exchange for tokens
  const tokenRes = await app(
    new Request("http://localhost/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        code_verifier: verifier,
        redirect_uri: "myapp://cb",
      }),
    }),
  );
  expect(tokenRes.status).toBe(200);
  const tokens = await j(tokenRes);
  expect(tokens.token_type).toBe("Bearer");
  expect(tokens.access_token.length).toBeGreaterThan(0);
  expect(tokens.refresh_token.startsWith("oat_")).toBe(true);
  expect(tokens.scope).toBe("read");
});

test("auth code is single-use", async () => {
  const create = await j(
    await app(
      new Request("http://localhost/admin/oauth/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "App",
          redirect_uris: ["myapp://cb"],
          allowed_scopes: ["read"],
        }),
      }),
    ),
  );
  const { verifier, challenge } = pkcePair();
  const approve = await j(
    await app(
      new Request("http://localhost/oauth/authorize/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          response_type: "code",
          client_id: create.client_id,
          redirect_uri: "myapp://cb",
          code_challenge: challenge,
          code_challenge_method: "S256",
        }),
      }),
    ),
  );
  const code = new URL(approve.redirect_url).searchParams.get("code");
  const exchange = (extraBody = {}) =>
    app(
      new Request("http://localhost/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: create.client_id,
          code,
          code_verifier: verifier,
          redirect_uri: "myapp://cb",
          ...extraBody,
        }),
      }),
    );

  const first = await exchange();
  expect(first.status).toBe(200);
  const second = await exchange();
  expect(second.status).toBe(400);
  const err = await j(second);
  expect(err.error).toBe("invalid_grant");
});

test("token endpoint rejects PKCE verifier mismatch", async () => {
  const create = await j(
    await app(
      new Request("http://localhost/admin/oauth/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "App",
          redirect_uris: ["myapp://cb"],
          allowed_scopes: ["read"],
        }),
      }),
    ),
  );
  const { challenge } = pkcePair();
  const approve = await j(
    await app(
      new Request("http://localhost/oauth/authorize/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          response_type: "code",
          client_id: create.client_id,
          redirect_uri: "myapp://cb",
          code_challenge: challenge,
          code_challenge_method: "S256",
        }),
      }),
    ),
  );
  const code = new URL(approve.redirect_url).searchParams.get("code");
  const wrongVerifier = b64url(randomBytes(32));
  const res = await app(
    new Request("http://localhost/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: create.client_id,
        code,
        code_verifier: wrongVerifier,
        redirect_uri: "myapp://cb",
      }),
    }),
  );
  expect(res.status).toBe(400);
  expect((await j(res)).error).toBe("invalid_grant");
});

test("authorize without code_challenge is rejected (PKCE mandatory)", async () => {
  const create = await j(
    await app(
      new Request("http://localhost/admin/oauth/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "App",
          redirect_uris: ["myapp://cb"],
          allowed_scopes: ["read"],
        }),
      }),
    ),
  );
  const res = await app(
    new Request(
      `http://localhost/oauth/authorize/info?response_type=code&client_id=${create.client_id}&redirect_uri=${encodeURIComponent("myapp://cb")}`,
    ),
  );
  expect(res.status).toBe(400);
});

test("authorize rejects an unregistered redirect_uri (exact-match)", async () => {
  const create = await j(
    await app(
      new Request("http://localhost/admin/oauth/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "App",
          redirect_uris: ["myapp://cb"],
          allowed_scopes: ["read"],
        }),
      }),
    ),
  );
  const { challenge } = pkcePair();
  const res = await app(
    new Request(
      `http://localhost/oauth/authorize/info?response_type=code&client_id=${create.client_id}&redirect_uri=${encodeURIComponent("myapp://cb/extra")}&code_challenge=${challenge}`,
    ),
  );
  expect(res.status).toBe(400);
});

test("refresh-token grant rotates and revokes the old token", async () => {
  const create = await j(
    await app(
      new Request("http://localhost/admin/oauth/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "App",
          redirect_uris: ["myapp://cb"],
          allowed_scopes: ["read"],
        }),
      }),
    ),
  );
  const { verifier, challenge } = pkcePair();
  const approve = await j(
    await app(
      new Request("http://localhost/oauth/authorize/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          response_type: "code",
          client_id: create.client_id,
          redirect_uri: "myapp://cb",
          code_challenge: challenge,
          code_challenge_method: "S256",
        }),
      }),
    ),
  );
  const code = new URL(approve.redirect_url).searchParams.get("code");
  const tokens = await j(
    await app(
      new Request("http://localhost/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: create.client_id,
          code,
          code_verifier: verifier,
          redirect_uri: "myapp://cb",
        }),
      }),
    ),
  );

  // First refresh succeeds and returns a new pair.
  const refreshed = await j(
    await app(
      new Request("http://localhost/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: create.client_id,
          refresh_token: tokens.refresh_token,
        }),
      }),
    ),
  );
  expect(refreshed.refresh_token.startsWith("oat_")).toBe(true);
  expect(refreshed.refresh_token).not.toBe(tokens.refresh_token);

  // Reusing the OLD refresh token must fail and burn the chain.
  const reuse = await app(
    new Request("http://localhost/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: create.client_id,
        refresh_token: tokens.refresh_token,
      }),
    }),
  );
  expect(reuse.status).toBe(400);
  // The new refresh token issued above is now also dead.
  const afterBurn = await app(
    new Request("http://localhost/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: create.client_id,
        refresh_token: refreshed.refresh_token,
      }),
    }),
  );
  expect(afterBurn.status).toBe(400);
});

test("revoke endpoint silently succeeds for unknown tokens", async () => {
  const res = await app(
    new Request("http://localhost/oauth/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "oat_doesnotexist" }),
    }),
  );
  expect(res.status).toBe(200);
});

test("revoke endpoint requires a token field", async () => {
  const res = await app(
    new Request("http://localhost/oauth/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
  expect(res.status).toBe(400);
});

test("discovery endpoint advertises the right grant types and scopes", async () => {
  const res = await app(new Request("http://localhost/.well-known/oauth-authorization-server"));
  expect(res.status).toBe(200);
  const meta = await j(res);
  expect(meta.issuer).toBe("http://localhost");
  expect(meta.token_endpoint).toBe("http://localhost/oauth/token");
  expect(meta.grant_types_supported).toContain("authorization_code");
  expect(meta.grant_types_supported).toContain("refresh_token");
  expect(meta.grant_types_supported).toContain("urn:ietf:params:oauth:grant-type:device_code");
  expect(meta.code_challenge_methods_supported).toEqual(["S256"]);
  expect(meta.scopes_supported).toEqual(["read", "write", "share"]);
});

test("device flow: authorize → info → approve → token", async () => {
  const create = await j(
    await app(
      new Request("http://localhost/admin/oauth/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Device app",
          redirect_uris: ["myapp://cb"],
          allowed_scopes: ["read"],
        }),
      }),
    ),
  );

  // Step 1: device starts the flow.
  const start = await j(
    await app(
      new Request("http://localhost/oauth/device/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: create.client_id, scope: "read" }),
      }),
    ),
  );
  expect(start.device_code.length).toBeGreaterThan(0);
  expect(start.user_code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  expect(start.interval).toBe(5);

  // Step 2: SPA fetches consent metadata.
  const info = await j(
    await app(new Request(`http://localhost/oauth/device/info?user_code=${encodeURIComponent(start.user_code)}`)),
  );
  expect(info.client.client_id).toBe(create.client_id);

  // Step 3: SPA records approval.
  const approve = await app(
    new Request("http://localhost/oauth/device/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_code: start.user_code }),
    }),
  );
  expect(approve.status).toBe(200);

  // Step 4: device polls token endpoint and gets tokens.
  const tokenRes = await app(
    new Request("http://localhost/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: create.client_id,
        device_code: start.device_code,
      }),
    }),
  );
  expect(tokenRes.status).toBe(200);
  const tokens = await j(tokenRes);
  expect(tokens.access_token.length).toBeGreaterThan(0);
  expect(tokens.refresh_token.startsWith("oat_")).toBe(true);
});

test("device flow: polling before approval returns authorization_pending", async () => {
  const create = await j(
    await app(
      new Request("http://localhost/admin/oauth/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Device app",
          redirect_uris: ["myapp://cb"],
          allowed_scopes: ["read"],
        }),
      }),
    ),
  );
  const start = await j(
    await app(
      new Request("http://localhost/oauth/device/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: create.client_id }),
      }),
    ),
  );
  const res = await app(
    new Request("http://localhost/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: create.client_id,
        device_code: start.device_code,
      }),
    }),
  );
  expect(res.status).toBe(400);
  expect((await j(res)).error).toBe("authorization_pending");
});

test("client revoke invalidates outstanding refresh tokens", async () => {
  const create = await j(
    await app(
      new Request("http://localhost/admin/oauth/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "App",
          redirect_uris: ["myapp://cb"],
          allowed_scopes: ["read"],
        }),
      }),
    ),
  );
  const { verifier, challenge } = pkcePair();
  const approve = await j(
    await app(
      new Request("http://localhost/oauth/authorize/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          response_type: "code",
          client_id: create.client_id,
          redirect_uri: "myapp://cb",
          code_challenge: challenge,
          code_challenge_method: "S256",
        }),
      }),
    ),
  );
  const code = new URL(approve.redirect_url).searchParams.get("code");
  const tokens = await j(
    await app(
      new Request("http://localhost/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: create.client_id,
          code,
          code_verifier: verifier,
          redirect_uri: "myapp://cb",
        }),
      }),
    ),
  );

  // Revoke client.
  await app(new Request(`http://localhost/admin/oauth/clients/${create.id}`, { method: "DELETE" }));

  // Refresh should now fail.
  const refresh = await app(
    new Request("http://localhost/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: create.client_id,
        refresh_token: tokens.refresh_token,
      }),
    }),
  );
  expect(refresh.status).toBe(400);
});
