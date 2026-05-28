# @atlas/sso

Drop-in OIDC relying-party. Any Atlas app gains "Sign in with $IdP" by calling
`mountSso(cfg)` and providing two callbacks: `onAuthenticated` (claims → local
user row) and `issueSession` (set whatever session the host app uses). The
package handles discovery, PKCE, state, code exchange, id_token verification,
and back-channel logout.

## Exports

```
mountSso(cfg: SsoConfig) → readonly Route[]      mount /login + /callback + /logout
ensureSsoStateTable(db, table?)                  idempotent CREATE TABLE IF NOT EXISTS
sweepExpiredSsoState(db, table?)                 delete expired state rows
clearDiscoveryCache()                            for tests / hot-reload
```

## Types

```
IdTokenClaims { sub, iss, aud, email?, email_verified?, name?, preferred_username?, picture?, ... }

AuthenticatedUser { localUserId: number|string, displayName? }

SessionIssuer = (conn, user, claims) => Promise<Conn> | Conn

SsoConfig {
  db: Connection
  issuerUrl: string                          // base URL — discovery doc lives at ${issuerUrl}/.well-known/openid-configuration
  clientId: string
  clientSecret: string
  redirectUri?: string                       // default: ${request.origin}${basePath}/callback
  scopes?: readonly string[]                 // default: ["openid","email","profile"] — openid is always added
  basePath?: string                          // default: "/auth/sso"
  defaultPostLoginPath?: string              // default: "/"
  stateTable?: string                        // default: "sso_state"

  onAuthenticated(db, claims) → AuthenticatedUser      // upsert local user, return its id
  issueSession(conn, user, claims) → Conn              // set cookie/JWT/etc., redirect home

  findLocalUserBySub?(db, sub) → number|string|null    // for back-channel logout
  invalidateSessions?(db, { sub, localUserId }) → void // revoke all sessions for that user
}

DiscoveryDoc { issuer, authorization_endpoint, token_endpoint, jwks_uri, userinfo_endpoint?, end_session_endpoint?, id_token_signing_alg_values_supported? }
```

## Routes mounted

`mountSso` returns four routes under `basePath` (default `/auth/sso`):

| Method + Path | Purpose |
|---|---|
| `GET /login`          | Generate state + PKCE + nonce, persist them, 302 to IdP's authorize endpoint. Honors `?return_to=` for deep links. |
| `GET /callback`       | Validate state, exchange code, verify id_token, call `onAuthenticated`, then `issueSession`. |
| `POST /logout`        | Back-channel logout (RP-initiated end-session, when the IdP advertises one). |
| `POST /backchannel-logout` | Receive IdP-pushed logout token, verify, look up `localUserId` via `findLocalUserBySub`, call `invalidateSessions`. |

## Wire up

```ts
import { connect, from } from "@atlas/db"
import { router, serve } from "@atlas/server"
import { ensureSsoStateTable, mountSso, type IdTokenClaims, type SsoConfig } from "@atlas/sso"

const db = connect({ driver: "sqlite", path: "./app.db" })
await ensureSsoStateTable(db)

const cfg: SsoConfig = {
  db,
  issuerUrl: process.env.SSO_ISSUER!,
  clientId: process.env.SSO_CLIENT_ID!,
  clientSecret: process.env.SSO_CLIENT_SECRET!,
  onAuthenticated: async (db, claims) => {
    const id = await upsertUserFromClaims(db, claims)
    return { localUserId: id, displayName: claims.name ?? claims.preferred_username }
  },
  issueSession: async (conn, user, _claims) => issueLocalSession(conn, user.localUserId),
}

serve({ routes: router(...mountSso(cfg)) })
```

## State table

`ensureSsoStateTable` creates the transient row store that bridges the
/login → /callback redirect:

```sql
CREATE TABLE IF NOT EXISTS sso_state (
  state       TEXT PRIMARY KEY,
  verifier    TEXT NOT NULL,
  nonce       TEXT NOT NULL,
  return_to   TEXT NOT NULL DEFAULT '/',
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Schedule `sweepExpiredSsoState(db)` to run periodically (rows TTL is 10 min):

```ts
setInterval(() => sweepExpiredSsoState(db), 60 * 60 * 1000)  // hourly
```

## Discovery

`@atlas/sso` fetches the IdP's discovery doc lazily on the first request
(and caches it). Tests can call `clearDiscoveryCache()` between runs.

## Dependencies

- `@atlas/auth` — JWT verification for id_tokens
- `@atlas/db` — state-row persistence
- `@atlas/server` — `mountSso` returns `Route[]` you spread into your router
- External: none. Uses `fetch` and Web Crypto.

## Compared to `@atlas/auth/social`

- `@atlas/auth/social` — provider-specific factories (Google, GitHub, Apple, …). Best for consumer apps with named providers.
- `@atlas/sso` — generic OIDC relying-party. Best for enterprise SSO (Keycloak, Auth0, Okta, Castle, anything OIDC-conformant).
