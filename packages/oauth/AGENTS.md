# @atlas/oauth

Pluggable OAuth 2.1 authorization server. PKCE-required, refresh-token
rotation with reuse detection, RFC 8628 device-code flow, dynamic client
management, and RFC 8414 discovery — all as `Route[]` you mount on
`@atlas/server`.

The package is route-only. Your app owns the user table, the consent UI, and
whatever guard pipes you want to put in front of it.

## Quick start

```ts
import { oauthRoutes } from "@atlas/oauth"
import { requireAuth } from "@atlas/auth"
import { from } from "@atlas/db"
import { compose } from "@atlas/server"

const cfg = {
  db,
  secret: process.env.JWT_SECRET!,
  scopes: ["read", "write", "share"],
  loadUser: (db, id) => db.one(from("users").where(q => q("id").equals(id))),
  buildAccessTokenClaims: (user) => ({
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
  }),
  requireUser: requireAuth({ secret: process.env.JWT_SECRET! }),
  requireAdmin: ownerOnlyPipe,  // your own admin guard
}

Bun.serve({
  port: 3000,
  fetch: compose([...oauthRoutes(cfg), ...yourAppRoutes]),
})
```

## What gets mounted

`oauthRoutes(cfg, { basePath?, adminBasePath? })` returns:

| Method | Path (under basePath) | Auth | Description |
|--------|----------------------|------|-------------|
| GET    | `/authorize/info`           | requireUser  | Validate authorize params, return client + scopes for the consent screen |
| POST   | `/authorize/approve`        | requireUser  | Issue an auth code; returns `redirect_url` |
| POST   | `/authorize/deny`           | requireUser  | Returns the error redirect URL |
| POST   | `/token`                    | client cred  | `authorization_code`, `refresh_token`, `device_code` grants |
| POST   | `/revoke`                   | open         | RFC 7009 revocation |
| POST   | `/device/authorize`         | open         | RFC 8628 — start device-code flow |
| GET    | `/device/info`              | requireUser  | Consent metadata for `/pair` SPA |
| POST   | `/device/approve`           | requireUser  | Record approval against a user_code |
| POST   | `/device/deny`              | requireUser  | Record denial |
| GET    | `/.well-known/oauth-authorization-server` | open | RFC 8414 discovery |

Plus admin (under `adminBasePath`, default `/admin/oauth`):

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/clients`                       | List clients |
| POST   | `/clients`                       | Create client (returns `client_secret` once for confidential clients) |
| PATCH  | `/clients/:id`                   | Update name / description / scopes / redirect_uris |
| POST   | `/clients/:id/rotate-secret`     | Rotate secret + invalidate all refresh tokens |
| DELETE | `/clients/:id`                   | Soft-revoke client + invalidate refresh tokens |

## Configuration

```ts
type OAuthConfig = {
  db: Connection
  secret: string                      // JWT signing secret
  scopes: readonly string[]           // scopes you're willing to grant

  loadUser: (db, userId) => Promise<OAuthUser | null>
  buildAccessTokenClaims: (user) => Record<string, unknown>

  requireUser: PipeFn                 // guard for consent screens — usually requireAuth
  requireAdmin: PipeFn                // guard for /admin/oauth/clients

  userIdFromConn?: (conn) => number | string  // default: conn.assigns.auth.id
  audit?: (ev) => void                        // optional audit hook
  requestContext?: (req) => { ip?, userAgent? }
  buildVerificationUri?: (req) => string      // default: ${origin}/pair

  tables?: {
    clients?: string                  // default oauth_clients
    authorizationCodes?: string       // default oauth_authorization_codes
    refreshTokens?: string            // default oauth_refresh_tokens
    deviceCodes?: string              // default oauth_device_codes
  }
}
```

`buildAccessTokenClaims` is the only place your user shape leaks into the JWT.
The library merges in `{ client_id, scope, jti }` regardless of what you
return.

`audit` integrates cleanly with `@atlas/security`'s `AuditLogger`:

```ts
import { createAuditLogger } from "@atlas/security"
const audit = createAuditLogger({ db })
const cfg: OAuthConfig = { ...rest, audit: audit.log }
```

## Schema

```sql
-- clients
CREATE TABLE oauth_clients (
  id                  SERIAL PRIMARY KEY,
  client_id           TEXT UNIQUE NOT NULL,
  client_secret_hash  TEXT NULL,         -- null = public client (PKCE only)
  name                TEXT NOT NULL,
  description         TEXT NULL,
  icon_url            TEXT NULL,
  redirect_uris       TEXT NOT NULL,     -- JSON array
  allowed_scopes      TEXT NOT NULL,     -- JSON array
  is_official         BOOLEAN NOT NULL DEFAULT FALSE,
  created_by          INTEGER NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  revoked_at          TIMESTAMPTZ NULL
);

-- single-use authorization codes (60s TTL)
CREATE TABLE oauth_authorization_codes (
  code                  TEXT PRIMARY KEY,
  client_id             TEXT NOT NULL,
  user_id               INTEGER NOT NULL,
  redirect_uri          TEXT NOT NULL,
  code_challenge        TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL,
  scope                 TEXT NOT NULL,
  expires_at            TIMESTAMPTZ NOT NULL,
  used_at               TIMESTAMPTZ NULL
);

-- refresh tokens (30d TTL, rotated on every use)
CREATE TABLE oauth_refresh_tokens (
  token_hash         TEXT PRIMARY KEY,   -- SHA-256 hex of the plaintext
  client_id          TEXT NOT NULL,
  user_id            INTEGER NOT NULL,
  scope              TEXT NOT NULL,
  parent_token_hash  TEXT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  expires_at         TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ NULL
);

-- device-flow codes (10m TTL)
CREATE TABLE oauth_device_codes (
  device_code      TEXT PRIMARY KEY,
  user_code        TEXT UNIQUE NOT NULL,
  client_id        TEXT NOT NULL,
  scope            TEXT NOT NULL,
  user_id          INTEGER NULL,
  approved_at      TIMESTAMPTZ NULL,
  denied_at        TIMESTAMPTZ NULL,
  last_polled_at   TIMESTAMPTZ NULL,
  expires_at       TIMESTAMPTZ NOT NULL
);
```

## Sweeps

```ts
import { sweepExpired } from "@atlas/oauth"

setInterval(() => sweepExpired(cfg), 60 * 60 * 1000)  // hourly
```

`sweepExpired` runs all three table sweeps in parallel; each is also exported
individually if you want to schedule them differently.

## Helpers

`@atlas/oauth` re-exports the building blocks:

```ts
import {
  randomId, shortId,           // ID minting
  verifyPkceS256, sha256,      // crypto
  parseScope, formatScope, includesScopes, isAllowedRedirect,
  newUserCode, normalizeUserCode,
  ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS, DEVICE_CODE_TTL_SECONDS, DEVICE_POLL_INTERVAL_SECONDS,
} from "@atlas/oauth"
```

## Security notes

- **PKCE is mandatory** for the authorization-code grant — no `code_challenge`
  → `invalid_request`.
- Refresh tokens are **rotated on every use** and the **prior chain is burned
  on revoked-token reuse** (a strong leakage signal).
- `redirect_uri` matching is **exact-string only**, per OAuth 2.0 Security
  BCP. No prefix or substring matching.
- Client secrets are stored as SHA-256 hex; verification is constant-time.
- The plaintext `client_secret` is returned **exactly once** at creation /
  rotation. Surface that in your admin UI and discard.

## Dependencies

- `@atlas/auth` — `token.sign` for access-token JWTs
- `@atlas/db` — query builder
- `@atlas/server` — route + pipe types

## Testing

```sh
bun test packages/oauth/
```
