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

## Dependencies

- `@atlas/db` - database access for flows
- `@atlas/server` - Conn/PipeFn types for flows
- Zero external dependencies; uses Bun.password and Web Crypto API

## Testing

```sh
bun test packages/auth/
```
