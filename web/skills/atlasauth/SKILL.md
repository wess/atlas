---
name: atlasauth
description: Add authentication to Atlas apps with @wess/atlas/auth and @wess/atlas/security. Use for password hashing, JWTs, login and signup routes, protecting routes, social sign-in, SSO, running an OAuth server, revocable sessions, or TOTP.
---

# Atlas auth

## Which module

| Need | Use |
|---|---|
| Email and password with JWTs | `@wess/atlas/auth/flows`, `/auth/password`, `/auth/token` |
| Sign in with Google, GitHub, Apple, Microsoft, Facebook, X, TikTok | `@wess/atlas/auth/social` |
| Sign in with a company OIDC provider | `@wess/atlas/sso` (`mountSso`) |
| Be the identity provider, issuing tokens | `@wess/atlas/oauth` (`oauthRoutes`) |
| Sessions you can revoke | `createSessionStore` from `@wess/atlas/security` |
| Two-factor | `generateSecret`, `verifyTotp`, `otpauthUrl` from `@wess/atlas/security` |
| Admin panel sign-in | the `atlasadmin` skill |

## Passwords and tokens

`token.sign` and `token.verify` are async. A missing `await` puts `[object Promise]` in a cookie without a type error.

```ts
import { hash, verify } from "@wess/atlas/auth/password"
import { sign, verify as verifyToken } from "@wess/atlas/auth/token"

export const examples = async () => {
  const stored = await hash("a password")
  const matches = await verify("a password", stored)
  const jwt = await sign({ userId: 1 }, secret, { expiresIn: 3600 })
  const claims = await verifyToken(jwt, secret)
  return { matches, claims }
}
```

`expiresIn` is in seconds.

## Login, signup, and guards

```ts
import { login, requireAuth, signup } from "@wess/atlas/auth/flows"
import { sign } from "@wess/atlas/auth/token"
import { get, json, parseJson, pipe, pipeline, post } from "@wess/atlas/server"

const parsed = pipeline(parseJson)
const authed = pipeline(requireAuth({ secret }))

export const authRoutes = [
  post(
    "/auth/signup",
    parsed(
      signup({
        db,
        table: "users",
        fields: ["email", "password"],
        onSuccess: (conn, user) => json(conn, 201, { id: user.id }),
      }),
    ),
  ),
  post(
    "/auth/login",
    parsed(
      login({
        db,
        table: "users",
        identity: "email",
        password: "password",
        onSuccess: async (conn, user) => json(conn, 200, { token: await sign({ userId: user.id }, secret, { expiresIn: 3600 }) }),
      }),
    ),
  ),
  get("/me", authed(pipe((c) => json(c, 200, c.assigns.auth)))),
]
```

These flows need a column named `password`, which holds the hash. `onSuccess` receives the full row without it.

`requireAuth` reads `Authorization: Bearer` and puts the claims on `conn.assigns.auth`. It proves identity, not permission, so check roles in your own pipe and throw `forbidden()`.

## Social sign-in

```ts
import { github, socialAuth } from "@wess/atlas/auth/social"
import { get, json } from "@wess/atlas/server"

const social = socialAuth({
  secret,
  providers: { github: github({ clientId: "id", clientSecret: "secret", redirectUri: "https://app.test/auth/github/callback" }) },
})

export const socialRoutes = [
  get("/auth/github", social.start("github")),
  get(
    "/auth/github/callback",
    social.callback("github", { onSuccess: (conn, result) => json(conn, 200, { email: result.profile.email }) }),
  ),
]
```

State and PKCE live in a signed `HttpOnly` cookie. Match accounts on the provider and `profile.id`, not on email alone.

## Revocable sessions

JWTs can't be revoked on their own. When sign-out has to take effect immediately, use `createSessionStore({ db, secret, ttlSeconds })`, which provides `.issue`, `.isActive`, `.revoke`, and `.revokeAll`. `createMemoryStore` from `/auth/session` is for development only.

## Always

- Rate limit login by account and by client IP (`atlasserver` shows how).
- Return the same error for an unknown email and a wrong password.
- Store secrets through `defineConfig`, and require at least 32 random characters.
