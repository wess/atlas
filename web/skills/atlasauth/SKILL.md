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
| Two-factor | `generateSecret`, `matchTotp`, `otpauthUrl` from `@wess/atlas/security` |
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

`expiresIn` is in seconds. Always pass it for anything that grants access: `verify` checks `exp` when present but doesn't require it, so a token signed without it never expires.

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
        onSuccess: async (conn, user) =>
          json(conn, 200, { token: await sign({ userId: user.id }, secret, { expiresIn: 3600 }) }),
      }),
    ),
  ),
  get("/me", authed(pipe((c) => json(c, 200, c.assigns.auth)))),
]
```

These flows need a column named `password`, which holds the hash. `onSuccess` receives the full row without it.

`requireAuth` reads `Authorization: Bearer` and puts the claims on `conn.assigns.auth`. It proves identity, not permission, so check roles in your own pipe and throw `forbidden()`. It refuses OAuth access tokens (`typ: at+jwt`) and any token with a `purpose` claim, such as a password reset. Only an API meant for OAuth clients passes `acceptAccessTokens: true`, and then checks `conn.assigns.auth.scope`.

Login runs a dummy password verify for unknown accounts so timing doesn't reveal them. Signup's 409 on a duplicate does reveal that an account exists; rate limit it.

## Password reset

`passwordReset` doesn't await `transport` (so timing can't reveal accounts) and binds the token to the current password hash. Check it with `verifyPasswordReset` before saving the new password; it throws once the password has changed, so each link works once.

```ts
import { hash } from "@wess/atlas/auth/password"
import { passwordReset, verifyPasswordReset } from "@wess/atlas/auth/flows"
import { from } from "@wess/atlas/db/query"

export const requestReset = passwordReset({
  db,
  table: "users",
  secret,
  transport: async (email, resetToken) => console.log(email, resetToken.length),
})

export const confirmReset = async (resetToken: string, password: string) => {
  const { email } = await verifyPasswordReset(resetToken, secret, async (address) => {
    const user = await db.one<{ password: string }>(from("users").where((q) => q("email").equals(address)))
    return user?.password ?? null
  })
  await db.execute(from("users").where((q) => q("email").equals(email)).update({ password: await hash(password) }))
}
```

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

`returnTo` is opaque state handed back to your callback, and Atlas never redirects to it. Pass anything you redirect to through `localReturnPath` from `/auth/social` first. Apple's form_post callback gets a `SameSite=None` state cookie automatically.

## OAuth server

Give `oauthRoutes` its own `secret` (`OAUTH_SECRET`), not the app's session secret, and set `issuer` in production. Access tokens are third-party grants: `requireAuth` and the admin panel refuse them by default.

## Revocable sessions

JWTs can't be revoked on their own. When sign-out has to take effect immediately, use `createSessionStore({ db, secret, ttlSeconds })`, which provides `.issue`, `.isActive`, `.revoke`, and `.revokeAll`. Its default JWT payload drops fields named like password, secret, or token; pass `payload` to pick claims. `createMemoryStore` from `/auth/session` is for development only.

## Two-factor

A TOTP code is valid for its whole window, so store the step `matchTotp` returns and pass it back as `afterStep`; a reused code then fails.

```ts
import { matchTotp } from "@wess/atlas/security"

export const checkCode = (totpSecret: string, code: string, lastStep: number | null) => {
  const step = matchTotp(totpSecret, code, { afterStep: lastStep ?? undefined })
  return step === null ? { ok: false as const } : { ok: true as const, saveLastStep: step }
}
```

## Always

- Rate limit login by account and by client IP (`atlasserver` shows how). Key IPs with `addressKey` so IPv6 counts per /64.
- Return the same error for an unknown email and a wrong password.
- Store secrets through `defineConfig`, and require at least 32 random characters.
