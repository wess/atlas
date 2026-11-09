# @wess/atlas/oauth

Pluggable OAuth 2.1 authorization server. PKCE-required, refresh-token
rotation with reuse detection, RFC 8628 device-code flow, dynamic client
management, and RFC 8414 discovery — all as `Route[]` you mount on
`@wess/atlas/server`.

The package is route-only. Your app owns the user table, the consent UI, and
whatever guard pipes you want to put in front of it.

## Quick start

```ts
import { oauthRoutes } from "@wess/atlas/oauth"
import { requireAuth } from "@wess/atlas/auth"
import { from } from "@wess/atlas/db"
import { router } from "@wess/atlas/server"

const cfg = {
  db,
  // a dedicated secret: access tokens are third-party grants, not app sessions
  secret: process.env.OAUTH_SECRET!,
  issuer: "https://id.example.com",   // set in production; otherwise taken from the Host header
  scopes: ["read", "write", "share"],
  loadUser: (db, id) => db.one(from("users").where(q => q("id").equals(id))),
  buildAccessTokenClaims: (user) => ({
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
  }),
  requireUser: requireAuth({ secret: process.env.JWT_SECRET! }),  // the app's own session secret
  requireAdmin: ownerOnlyPipe,  // your own admin guard
}

Bun.serve({
  port: 3000,
  fetch: router(...oauthRoutes(cfg), ...yourAppRoutes),
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
| POST   | `/revoke`                   | client cred  | RFC 7009 revocation (confidential clients must authenticate) |
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
  secret: string                      // access-token signing secret — use a dedicated OAUTH_SECRET
  issuer?: string                     // public issuer URL; default derives from the Host header
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

### Access tokens are not sessions

Access tokens are HS256 JWTs with the RFC 9068 header `typ: "at+jwt"`.
`requireAuth` from `@wess/atlas/auth` (and the admin panel's bearer and cookie
auth) **refuses them by default**, along with older tokens carrying
`client_id` + `scope`: otherwise a token a user granted a third-party client
with scope `read` would act as that user everywhere. Give OAuth its own
`OAUTH_SECRET` anyway, so custom guards that call `token.verify` directly
can't accept them either. For a resource API meant for OAuth clients, verify
with the OAuth secret and opt in:

```ts
const forClients = requireAuth({ secret: process.env.OAUTH_SECRET!, acceptAccessTokens: true })
// then check conn.assigns.auth.scope
```

### Issuer

`issuer` sets discovery URLs and the `iss` of id_tokens and logout tokens.
Unset, it comes from the request's Host header, which a client controls;
set it in production.

`audit` integrates cleanly with `@wess/atlas/security`'s `AuditLogger`:

```ts
import { createAuditLogger } from "@wess/atlas/security"
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
  used_at               TIMESTAMPTZ NULL,
  nonce                 TEXT NULL,
  auth_time             INTEGER NULL
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
import { sweepExpired } from "@wess/atlas/oauth"

setInterval(() => sweepExpired(cfg), 60 * 60 * 1000)  // hourly
```

`sweepExpired` runs all three table sweeps in parallel; each is also exported
individually if you want to schedule them differently.

## Helpers

`@wess/atlas/oauth` re-exports the building blocks:

```ts
import {
  randomId, shortId,           // ID minting
  verifyPkceS256, sha256,      // crypto
  parseScope, formatScope, includesScopes, isAllowedRedirect,
  newUserCode, normalizeUserCode,
  ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS, DEVICE_CODE_TTL_SECONDS, DEVICE_POLL_INTERVAL_SECONDS,
} from "@wess/atlas/oauth"
```

## Security notes

- **PKCE is mandatory** for the authorization-code grant — no `code_challenge`
  → `invalid_request`.
- Refresh tokens are **rotated on every use** and the **prior chain is burned
  on revoked-token reuse** (a strong leakage signal).
- `redirect_uri` matching is **exact-string only**, per OAuth 2.0 Security
  BCP. No prefix or substring matching.
- Client secrets are stored as SHA-256 hex; verification is constant-time.
- **Revocation** (RFC 7009): a refresh token issued to a confidential client
  can only be revoked by that client sending `client_id` + `client_secret`
  (401 `invalid_client` otherwise). A `client_id` that is sent must own the
  token. Public clients' tokens can be revoked by whoever holds them.
- **Authorization-code replay**: presenting a used code revokes every refresh
  token that client holds for the user (refresh rows don't record their code,
  so that is the narrowest set). Access tokens are stateless and expire within
  `ACCESS_TOKEN_TTL_SECONDS`.
- **userinfo** accepts only access tokens and answers a generic
  `invalid_token` without verification details.
- **end_session** (GET or form POST) only ends a session for an
  `id_token_hint` this issuer signed whose audience includes the `client_id`
  sent; without one it just redirects (or returns `{ logged_out: true }`), so a
  cross-site logout link can't end anyone's session. `onEndSession` is called
  once per client with a `backchannel_logout_uri`, receiving
  `{ userId, logoutToken, issuer, clientId, backchannelLogoutUri }`.
- The plaintext `client_secret` is returned **exactly once** at creation /
  rotation. Surface that in your admin UI and discard.

## Dependencies

- `@wess/atlas/auth` — `token.sign` for access-token JWTs
- `@wess/atlas/db` — query builder
- `@wess/atlas/server` — route + pipe types

## Testing

```sh
bun test packages/oauth/
```
