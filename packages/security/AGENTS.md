# @atlas/security

Security primitives every web app needs: response-hardening headers, rate
limiting, audit logging, TOTP/2FA, and revocable JWT sessions.

## Modules

| Submodule | What it gives you |
|-----------|------------------|
| `headers` | `withSecurityHeaders` — strict default headers + CSP, plus a peer-IP shim that stashes `req.peerIp` for `clientIp` to read |
| `inline` | `decideInline` — safe-MIME allowlist for `Content-Disposition: inline` decisions |
| `ratelimit` | `createDbRateLimit` / `createMemoryRateLimit` + `clientIp` / `userAgent` / `parseTrustedProxies` |
| `audit` | `createAuditLogger` — fire-and-forget audit-event recorder |
| `totp` | `generateSecret`, `totpAt`, `verifyTotp`, `otpauthUrl`, `generateBackupCodes` |
| `sessions` | `createSessionStore` — DB-backed JWT sessions with revoke, sweep, and `last_used_at` |

Everything is exported from the package root: `import { ... } from "@atlas/security"`.

## Headers

```ts
import { withSecurityHeaders } from "@atlas/security"
import { serve } from "@atlas/server"

const fetch = withSecurityHeaders(buildFetch(routes), { dev: process.env.NODE_ENV !== "production" })
Bun.serve({ port: 3000, fetch })
```

Sets HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy` (camera/mic/geo/cohort off), COOP/CORP same-origin, and a
`Content-Security-Policy` that defaults to `'self'`-only with no inline scripts
in production. Pass `{ dev: true }` to relax script/connect for HMR, or `{ csp:
"…" }` to override entirely. Set `{ disableCsp: true }` for API-only origins.

The wrapper also stashes the Bun socket peer onto the request as `req.peerIp`
so downstream rate-limit / audit code reads the *real* peer rather than
trusting `X-Forwarded-For` from the client.

## Inline downloads

```ts
import { decideInline } from "@atlas/security"

const { contentType, disposition } = decideInline(file.mime, file.name, wantInline)
```

Forces `application/octet-stream; attachment` for any MIME outside a narrow
safe-list (images, video, audio, PDF, plain text). SVG is excluded — it parses
as XML and runs script.

## Rate limiting

```ts
import { createDbRateLimit, clientIp, parseTrustedProxies } from "@atlas/security"

const trustedProxies = parseTrustedProxies(process.env.TRUSTED_PROXIES)
const limiter = createDbRateLimit({ db })

const { ok, retryAfterSeconds } = await limiter.check(`signup:ip:${clientIp(req, { trustedProxies })}`, 5, 3600)
if (!ok) return Response.json({ error: "rate_limited", retry_after: retryAfterSeconds }, { status: 429 })
```

Postgres uses an atomic UPSERT; SQLite uses a transactional read-modify-write
inside a single transaction. Schema:

```sql
CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL  -- INTEGER unix-seconds on SQLite
);
```

`createMemoryRateLimit()` returns the same interface for tests / dev.

`clientIp(req, { trustedProxies })` returns the real client IP. It honors
`X-Forwarded-For` / `X-Real-IP` *only* when the request actually arrived from a
configured trusted proxy — otherwise the headers are attacker-supplied.

## Audit log

```ts
import { createAuditLogger } from "@atlas/security"

const audit = createAuditLogger({ db })

audit.log({ userId: 42, event: "user.login", ip: clientIp(req), userAgent: userAgent(req) })
```

Schema:

```sql
CREATE TABLE audit_events (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NULL,
  event       TEXT NOT NULL,
  metadata    TEXT NULL,            -- JSON
  ip          TEXT NULL,
  user_agent  TEXT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Logging is fire-and-forget — `log` never throws and never blocks the response.

## TOTP / 2FA

```ts
import { generateSecret, otpauthUrl, verifyTotp, generateBackupCodes } from "@atlas/security"

const secret = generateSecret()
const provisioning = otpauthUrl({ secret, account: user.email, issuer: "Atlas" })
// render `provisioning` as a QR code

if (!verifyTotp(secret, code, { window: 1 })) return Response.json({ error: "invalid_code" }, { status: 401 })

const backupCodes = generateBackupCodes()  // store hashed; show plaintext exactly once
```

Pure `node:crypto` — no external deps. SHA-1 / 6-digit / 30-second steps,
matching every authenticator app in the wild. `window: 1` accepts ±30s of
clock skew.

## Sessions

```ts
import { createSessionStore } from "@atlas/security"

const sessions = createSessionStore<{ id: number; email: string }>({
  db,
  secret: process.env.JWT_SECRET!,
  ttlSeconds: 86400 * 7,
})

// login
const { token, jti } = await sessions.issue(user, { ip: clientIp(req), userAgent: userAgent(req) })

// every request
const status = await sessions.isActive(jwtPayload.jti)
if (!status.active) return halt(401)
sessions.touch(jwtPayload.jti)

// logout / logout-everywhere
await sessions.revoke(jti, user.id)
await sessions.revokeAll(user.id, /* keep current */ jti)

// nightly cleanup
await sessions.sweepExpired()
```

The JWT stays stateless, but the embedded `jti` is bound to a row whose
`revoked_at` lets you kill a session server-side. Pair with
`@atlas/auth#requireAuth` plus a sessions check to enforce the revocation.

Schema:

```sql
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,        -- the jti
  user_id       INTEGER NOT NULL,
  ip            TEXT NULL,
  user_agent    TEXT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ NULL
);
```

Note: `@atlas/auth` already exports an in-memory `SessionStore` for simple
flows. The store here is a different (richer) interface — DB-backed,
revocable, with audit context. Pick whichever fits.

## Dependencies

- `@atlas/auth` — for `token.sign` (sessions only)
- `@atlas/db` — for the rate-limit / audit / session tables
- `node:crypto` — for TOTP and `randomUUID`

## Testing

```sh
bun test packages/security/
```
