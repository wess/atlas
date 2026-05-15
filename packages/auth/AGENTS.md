# @atlas/auth

Authentication primitives and prebuilt auth flow pipes for the Atlas framework.

## Exports

### Password Hashing

- `hash(password: string): Promise<string>` - Hash a password using Argon2id via Bun.password
- `verify(password: string, hashed: string): Promise<boolean>` - Verify a password against a hash

### JWT Tokens (`token` namespace)

- `token.sign(payload, secret, opts?): Promise<string>` - Create an HS256 JWT
  - `opts.expiresIn` - seconds until expiration
- `token.verify(token, secret): Promise<TokenPayload>` - Verify and decode a JWT
  - Throws on invalid signature, bad format, or expiration
- `TokenPayload` - `Record<string, unknown> & { iat?: number; exp?: number }`

### Session Management

- `createMemoryStore(): SessionStore` - In-memory session store for dev/testing
- `SessionStore` type with `create`, `get`, `destroy` methods

### Auth Flows (PipeFn factories for @atlas/server)

- `signup({ db, table, fields, onSuccess })` - Registration pipe
  - Reads body fields, hashes password, inserts into DB
  - Calls onSuccess with conn and new user record
- `login({ db, table, identity, password, onSuccess })` - Login pipe
  - Looks up user by identity field, verifies password
  - Calls onSuccess or halts 401
- `requireAuth({ secret })` - JWT guard pipe
  - Reads Bearer token from Authorization header
  - Puts decoded payload into `conn.assigns.auth`
  - Halts 401 if missing or invalid
- `passwordReset({ db, table, transport })` - Password reset pipe
  - Generates reset token, calls transport function
  - Always returns 200 to prevent email enumeration

## Usage

```ts
import { hash, verify, token, requireAuth, login, signup } from "@atlas/auth"

// password hashing
const hashed = await hash("mypassword")
const ok = await verify("mypassword", hashed)

// JWT
const jwt = await token.sign({ userId: 1 }, SECRET, { expiresIn: 3600 })
const payload = await token.verify(jwt, SECRET)

// auth guard pipe
const guard = requireAuth({ secret: SECRET })

// login flow
const loginPipe = login({
  db,
  table: "users",
  identity: "email",
  password: "password",
  onSuccess: (conn, user) =>
    json(conn, 200, { token: await token.sign({ userId: user.id }, SECRET) }),
})
```

### Social Login (`@atlas/auth/social`)

Pluggable OAuth-client side of authentication. Seven built-in providers — each
exported as a factory that takes its config and returns a `SocialProvider`.

| Factory | Provider | Notes |
|---------|----------|-------|
| `google({ clientId, clientSecret, redirectUri, hostedDomain?, prompt? })` | Google OIDC | id_token-based profile, `offline` access |
| `github({ clientId, clientSecret, redirectUri, allowSignup? })` | GitHub OAuth2 | falls back to `/user/emails` when primary email is private |
| `apple({ clientId, teamId, keyId, privateKey, redirectUri, responseMode? })` | Sign in with Apple | mints ES256 client_secret JWT per request; default `response_mode=form_post` |
| `microsoft({ clientId, clientSecret, redirectUri, tenant?, prompt? })` | Microsoft / Entra ID | tenant-aware (`common`, `consumers`, `organizations`, or a tenant ID) |
| `facebook({ clientId, clientSecret, redirectUri, apiVersion?, profileFields? })` | Meta Graph API | scope joined with commas, default `v19.0` |
| `twitter({ clientId, clientSecret?, redirectUri, userFields? })` | X (OAuth 2 + PKCE) | confidential clients use Basic auth on `/oauth2/token` |
| `tiktok({ clientKey, clientSecret, redirectUri, userFields? })` | TikTok Login Kit | uses `client_key` (not `client_id`), scopes are comma-joined, profile id is `open_id` |

All providers are PKCE-S256, scope-configurable, and return a normalized
`SocialProfile`:

```ts
type SocialProfile = {
  provider: string
  id: string
  email?: string | null
  emailVerified?: boolean
  name?: string | null
  picture?: string | null
  username?: string | null
  raw: Record<string, unknown>
}
```

#### Usage

```ts
import {
  socialAuth, google, github, apple, microsoft, facebook, twitter, tiktok,
} from "@atlas/auth/social"
import { router, get } from "@atlas/server"
import * as token from "@atlas/auth"

const social = socialAuth({
  secret: process.env.OAUTH_STATE_SECRET!,
  providers: {
    google:    google({ clientId, clientSecret, redirectUri: `${origin}/auth/google/callback` }),
    github:    github({ clientId, clientSecret, redirectUri: `${origin}/auth/github/callback` }),
    apple:     apple({ clientId, teamId, keyId, privateKey, redirectUri: `${origin}/auth/apple/callback` }),
    microsoft: microsoft({ clientId, clientSecret, redirectUri: `${origin}/auth/microsoft/callback` }),
    facebook:  facebook({ clientId, clientSecret, redirectUri: `${origin}/auth/facebook/callback` }),
    twitter:   twitter({ clientId, redirectUri: `${origin}/auth/twitter/callback` }),
    tiktok:    tiktok({ clientKey, clientSecret, redirectUri: `${origin}/auth/tiktok/callback` }),
  },
})

const routes = [
  get("/auth/google", social.start("google", { returnTo: "/welcome" })),
  get("/auth/google/callback", social.callback("google", {
    onSuccess: async (conn, { profile, returnTo }) => {
      // app owns the user table — upsert here
      const user = await upsertUserFromProfile(profile)
      const jwt = await token.sign({ sub: user.id }, JWT_SECRET, { expiresIn: 3600 })
      return redirect(putHeader(conn, "set-cookie", `session=${jwt}; HttpOnly; Path=/`), returnTo ?? "/")
    },
  })),
  // …same for github / apple / microsoft / facebook / twitter
]
```

Apple uses `response_mode=form_post` by default, so the callback arrives as a
`POST` with form-encoded `code`/`state` in the body — mount the route with
`post(...)` and compose `parseForm` before `social.callback("apple", …)`.

#### Stateless flow

State + PKCE verifier live in a signed, HttpOnly, SameSite=lax cookie
(`_atlas_oauth_state` by default, 10-minute TTL). Override via
`socialAuth({ cookie: { name?, path?, secure?, sameSite? } })`. Behind a
non-HTTPS dev proxy, set `cookie: { secure: false }`.

#### Pure helpers

If you need to render the consent flow yourself (e.g. show a "Continue with X"
button list), call `social.authorize(name, opts?)` to get `{ url, cookie }`
without writing to a `Conn`. `social.complete(name, conn)` is the inverse —
verifies + exchanges + fetches and returns the normalized result.

## Dependencies

- `@atlas/db` - database access for flows
- `@atlas/server` - Conn/PipeFn types for flows and social pipes
- Zero external dependencies; uses Bun.password, Web Crypto, and `fetch`

## Testing

```sh
bun test packages/auth/
```
