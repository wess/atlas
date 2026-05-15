# Atlas Cookbook

Short recipes for patterns that don't justify a full package — copy-paste them
into your app, change the table names, and move on.

## Invite tokens

Single-use, unguessable tokens that grant access to one signup. The plaintext
token is shown to the inviter exactly once; only the SHA-256 hash is stored at
rest, so a database leak doesn't compromise unredeemed invites.

**Schema**

```sql
CREATE TABLE invites (
  id          SERIAL PRIMARY KEY,
  token_hash  TEXT UNIQUE NOT NULL,
  email       TEXT NULL,             -- optional: pre-bind to an email
  invited_by  INTEGER NOT NULL,
  used_at     TIMESTAMPTZ NULL,
  used_by     INTEGER NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Routes**

```ts
import { from } from "@atlas/db"
import { del, get, json, parseJson, pipeline, post } from "@atlas/server"
import { requireAuth } from "@atlas/auth"
import { randomBytes, createHash } from "node:crypto"

const randomToken = () => randomBytes(32).toString("base64url")
const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex")

export const inviteRoutes = (db, secret: string) => {
  const guard = pipeline(requireAuth({ secret }))
  const authed = pipeline(requireAuth({ secret }), parseJson)

  return [
    // List my invites — no plaintext tokens, only metadata.
    get("/invites", guard(async (c) => {
      const userId = c.assigns.auth.id
      const rows = await db.execute(
        from("invites")
          .where(q => q("invited_by").equals(userId))
          .select("id", "email", "used_at", "used_by", "created_at")
          .orderBy("created_at", "DESC"),
      )
      return json(c, 200, rows)
    })),

    // Create — plaintext token returned exactly once.
    post("/invites", authed(async (c) => {
      const userId = c.assigns.auth.id
      const { email } = c.body as { email?: string }
      const token = randomToken()
      const rows = await db.execute(
        from("invites")
          .insert({
            token_hash: sha256Hex(token),
            email: email?.toLowerCase() ?? null,
            invited_by: userId,
          })
          .returning("id", "email", "created_at"),
      )
      return json(c, 201, { ...rows[0], token })
    })),

    // Verify a token without consuming it (signup form prefill).
    get("/invites/:token/check", async (c) => {
      const row = await db.one(
        from("invites")
          .where(q => q("token_hash").equals(sha256Hex(c.params.token)))
          .select("email", "used_at"),
      )
      if (!row) return json(c, 404, { valid: false, error: "Invalid invite" })
      if (row.used_at) return json(c, 410, { valid: false, error: "Already used" })
      return json(c, 200, { valid: true, email: row.email })
    }),

    // Revoke an unused invite.
    del("/invites/:id", guard(async (c) => {
      const userId = c.assigns.auth.id
      const id = Number(c.params.id)
      const row = await db.one(
        from("invites")
          .where(q => q("id").equals(id))
          .where(q => q("invited_by").equals(userId)),
      )
      if (!row) return json(c, 404, { error: "Not found" })
      if (row.used_at) return json(c, 409, { error: "Cannot revoke a used invite" })
      await db.execute(from("invites").where(q => q("id").equals(id)).del())
      return json(c, 200, { revoked: id })
    })),
  ]
}
```

**Consuming an invite at signup** is just `UPDATE invites SET used_at = …,
used_by = … WHERE token_hash = … AND used_at IS NULL` inside the same
transaction that inserts the new user. The atomic check prevents double-use.

Pair with `@atlas/email`'s `inviteEmail` template to send the link.

---

## Waitlist

Trivially small — collect email addresses (with optional name + reason) before
launch. Useful as a one-route module.

**Schema**

```sql
CREATE TABLE invite_requests (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  name        TEXT NULL,
  reason      TEXT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON invite_requests (email);
```

**Route**

```ts
import { from } from "@atlas/db"
import { json, parseJson, pipeline, post } from "@atlas/server"
import { createDbRateLimit, clientIp } from "@atlas/security"

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export const waitlistRoutes = (db) => {
  const open = pipeline(parseJson)
  const limiter = createDbRateLimit({ db })

  return [
    post("/invite-requests", open(async (c) => {
      const { email, name, reason } = c.body as {
        email?: string; name?: string; reason?: string
      }
      const e = (email ?? "").trim().toLowerCase()
      if (!e || !isEmail(e)) return json(c, 422, { error: "Valid email required" })
      if ((reason?.length ?? 0) > 1000) return json(c, 422, { error: "Reason too long" })

      // Optional: rate-limit per IP so a bot can't pile junk entries.
      const { ok } = await limiter.check(`waitlist:${clientIp(c.request)}`, 5, 3600)
      if (!ok) return json(c, 429, { error: "Slow down" })

      await db.execute(
        from("invite_requests").insert({
          email: e,
          name: name?.trim() || null,
          reason: reason?.trim() || null,
        }),
      )
      return json(c, 200, { ok: true })
    })),
  ]
}
```

That's the whole feature. Add an admin list view on top when you're ready to
process the queue.

---

## Search query DSL

A small parser that lets users type `type:image foo bar` or `ext:pdf invoice`
and converts the result into something you can pass to `@atlas/db`. It's about
50 lines and is roughly the same in every app, so keep it inline.

```ts
export type ParsedQuery = {
  name: string
  types: string[]
  exts: string[]
}

const MIME_CLASSES: Record<string, string[]> = {
  image: ["image/%"],
  video: ["video/%"],
  audio: ["audio/%"],
  text:  ["text/%"],
  document: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.%",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
  ],
}

export const mimePatternsFor = (klass: string): string[] =>
  MIME_CLASSES[klass] ?? []

export const escapeLike = (s: string): string =>
  s.replace(/([\\%_])/g, "\\$1")

export const parseQuery = (input: string): ParsedQuery => {
  const tokens = input.trim().split(/\s+/).filter(Boolean)
  const types: string[] = []
  const exts: string[] = []
  const name: string[] = []

  for (const tok of tokens) {
    const colon = tok.indexOf(":")
    if (colon > 0) {
      const key = tok.slice(0, colon).toLowerCase()
      const val = tok.slice(colon + 1).toLowerCase()
      if (!val) continue
      if (key === "type" && MIME_CLASSES[val]) { types.push(val); continue }
      if (key === "ext") { exts.push(val.replace(/^\./, "")); continue }
    }
    name.push(tok)
  }

  return { name: name.join(" "), types, exts }
}
```

**Using it**

```ts
import { from, raw } from "@atlas/db"

const { name, types, exts } = parseQuery(qParam)
const pattern = `%${escapeLike(name)}%`

let q = from("files")
  .where(p => p("user_id").equals(userId))
  .where(p => p("deleted_at").isNull())

if (name) q = q.where(p => p("name").ilike(pattern))

if (types.length > 0) {
  const mimes = types.flatMap(mimePatternsFor)
  q = q.where(p => p.or(...mimes.map(m => p("mime").ilike(m))))
}

if (exts.length > 0) {
  const patterns = exts.map(e => `%.${escapeLike(e)}`)
  q = q.where(p => p.or(...patterns.map(e => p("name").ilike(e))))
}

// Postgres pg_trgm: rank by similarity for free-text matches.
if (name) q = q.orderBy(raw("similarity(name, $1)", name), "DESC")
```

Add new operators (`size:>1mb`, `created:after:2025-01-01`, etc.) by extending
the `colon > 0` branch — the rest of the parser stays the same.

---

## Typed routes with auth + body validation

`@atlas/server` ships a `route()` helper (and `getR / postR / putR / patchR /
delR` shortcuts) that validates `params`, `body`, and `query` *before* your
handler runs and types `c.assigns` from your `before` pipes. JSON body parsing
is automatic when a `body` schema is set — you don't need to add `parseJson` to
`before`. Validation failures throw `unprocessable("Invalid <where>", ...)` so
they render as `422` JSON the same way every other `HttpError` does.

```ts
import { z } from "zod"
import { from, type RowOf } from "@atlas/db"
import { conflict, getR, json, notFound, postR } from "@atlas/server"
import { requireAuth } from "@atlas/auth"
import { posts } from "./schema"

type AuthClaims = { auth: { id: number } }

export const postRoutes = (db, secret: string) => {
  const auth = requireAuth({ secret })

  return [
    // GET /posts/:id  →  one post by id, typed end-to-end.
    getR<{ id: number }, never, Record<string, string>, AuthClaims>(
      "/posts/:id",
      {
        params: z.object({ id: z.coerce.number() }),
        before: [auth],
        assigns: {} as AuthClaims,
      },
      async (c) => {
        type Post = RowOf<typeof posts>
        const post: Post | null = await db.one(
          from(posts).where(q => q("id").equals(c.params.id))
        )
        if (!post) throw notFound("post")
        return json(c, 200, post)
      },
    ),

    // POST /posts  →  validated body; row is typed from the schema.
    postR<Record<string, never>, { content: string }, Record<string, string>, AuthClaims>(
      "/posts",
      {
        body: z.object({ content: z.string().min(1).max(280) }),
        before: [auth],
        assigns: {} as AuthClaims,
      },
      async (c) => {
        const [created] = await db.execute(
          from(posts)
            .insert({ userId: c.assigns.auth.id, content: c.body.content })
            .returning("id", "content"),
        )
        if (!created) throw conflict("could not create post")
        return json(c, 201, created)
      },
    ),
  ]
}
```

The `assigns: {} as AuthClaims` line is a *type-only* phantom — it doesn't run
at runtime; it just tells the handler that whatever ran in `before` populated
`c.assigns` with that shape. Pair it with a guard pipe like `requireAuth` that
actually does the assignment.

---

## Schema-first migrations with `migrate.diff`

`defineSchema()` already encodes your tables. Instead of hand-writing
`up.sql/down.sql`, point `migrate.diff` at the live database and let it emit
the SQL.

```ts
// scripts/diff.ts — run after editing src/schema.ts
import { connect } from "@atlas/db"
import { migrate } from "@atlas/migrate"
import { posts, users, follows, likes } from "../src/schema"

const db = connect({ driver: "postgres", url: process.env.DATABASE_URL! })
const result = await migrate.diff(db, [users, posts, follows, likes], {
  name: process.argv[2] ?? "diff",
  dir: "./migrations",
})

if (result.noop) console.log("schema in sync; nothing to write")
else console.log(`wrote ${result.path} (${result.plan.ops.length} ops)`)

await db.close()
```

```bash
bun scripts/diff.ts add_likes
# →  wrote ./migrations/20260508_add_likes (1 ops)

bun scripts/diff.ts            # idempotent: no-op when in sync
# →  schema in sync; nothing to write
```

**Watch the comments.** Type or nullability changes are emitted as `-- ALTER
table.column …` *comments*, never raw `ALTER` statements. Destructive
migrations need a human's eyes — the diff surfaces them but does not run them.

`migrate.plan(db, schemas)` returns the same `{ ops, up, down }` plan without
writing files; useful for CI checks ("fail if there are pending diffs"):

```ts
const plan = await migrate.plan(db, schemas)
if (plan.ops.length > 0) {
  console.error("schema drift detected:")
  console.error(plan.up)
  process.exit(1)
}
```

---

## Throw-style errors

Routes don't need to thread error responses through `if/else if (...)`. Throw
an `HttpError` and the router renders it as JSON with the right status, code,
and any custom headers.

```ts
import { conflict, getR, json, notFound, tooManyRequests } from "@atlas/server"
import { from } from "@atlas/db"

getR("/users/:id", { params: z.object({ id: z.coerce.number() }) }, async (c) => {
  const user = await db.one(from(users).where(q => q("id").equals(c.params.id)))
  if (!user) throw notFound("user not found")
  return json(c, 200, user)
})

// Custom headers ride along with the response.
postR("/heavy", { body: z.object({ /* … */ }) }, async (c) => {
  const allowed = await rateLimiter.check(`heavy:${c.assigns.auth.id}`, 10, 60)
  if (!allowed.ok) {
    throw tooManyRequests("slow down", {
      code: "RATE_LIMITED",
      headers: { "Retry-After": String(allowed.retryAfterSeconds) },
    })
  }
  // …
})
```

Available factories: `badRequest`, `unauthorized`, `forbidden`, `notFound`,
`methodNotAllowed`, `conflict`, `gone`, `unprocessable`, `tooManyRequests`,
`internal`, `serviceUnavailable`. All accept `(message?, { code?, details?,
headers? })`. Use `haltWith(conn, error)` if you'd rather short-circuit the
pipeline than `throw`.

---

## Social login (Google, GitHub, Apple, Microsoft, Facebook, X, TikTok)

`@atlas/auth/social` is the OAuth-*client* side: the user signs into Google/
GitHub/etc. and your app receives a normalized profile. State + PKCE verifier
ride in an HttpOnly, signed-JWT cookie (`_atlas_oauth_state`, 10-minute TTL)
so the flow stays stateless — no server-side session table required.

Your app still owns the user table. The callback hands you a `SocialProfile`
+ raw `TokenSet`; do whatever upsert/link logic you want, then mint your own
session JWT.

```ts
import { socialAuth, google, github, apple, microsoft, facebook, twitter, tiktok } from "@atlas/auth/social"
import { token, requireAuth } from "@atlas/auth"
import { from } from "@atlas/db"
import { get, post, redirect, putHeader, json } from "@atlas/server"

const origin = process.env.PUBLIC_ORIGIN!

const social = socialAuth({
  secret: process.env.OAUTH_STATE_SECRET!,
  cookie: { secure: process.env.NODE_ENV === "production" }, // off in HTTP dev
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

const upsertFromProfile = async (p: typeof social.providers.google extends never ? never : any) => {
  // Look up by (provider, providerId); fall back to email; create if neither matches.
  const existing = await db.one(
    from("users").where(q => q("provider").equals(p.provider)).where(q => q("providerId").equals(p.id))
  )
  if (existing) return existing
  const [created] = await db.execute(
    from("users").insert({
      provider: p.provider,
      providerId: p.id,
      email: p.email ?? null,
      name: p.name ?? null,
      picture: p.picture ?? null,
    }).returning("id", "email", "name")
  )
  return created
}

export const socialAuthRoutes = [
  // Start: one route per provider. Optional returnTo encodes the post-login destination.
  get("/auth/google",    social.start("google",    { returnTo: "/welcome" })),
  get("/auth/github",    social.start("github",    { returnTo: "/welcome" })),
  get("/auth/microsoft", social.start("microsoft", { returnTo: "/welcome" })),
  get("/auth/facebook",  social.start("facebook",  { returnTo: "/welcome" })),
  get("/auth/twitter",   social.start("twitter",   { returnTo: "/welcome" })),
  get("/auth/tiktok",    social.start("tiktok",    { returnTo: "/welcome" })),
  get("/auth/apple",     social.start("apple",     { returnTo: "/welcome" })),

  // Callback: app issues its own session JWT after upserting the user.
  get("/auth/google/callback", social.callback("google", {
    onSuccess: async (c, { profile, returnTo }) => {
      const user = await upsertFromProfile(profile)
      const jwt = await token.sign({ id: user.id }, process.env.JWT_SECRET!, { expiresIn: 86400 })
      const c2 = putHeader(c, "set-cookie", `session=${jwt}; HttpOnly; Path=/; SameSite=Lax`)
      return redirect(c2, returnTo ?? "/")
    },
    onError: async (c, err) => json(c, 401, { error: err.message }),
  })),
  // …same shape for github / microsoft / facebook / twitter / tiktok …

  // Apple uses response_mode=form_post by default, so its callback arrives as POST
  // with form-encoded code/state in the body. Compose parseForm in front of it:
  post("/auth/apple/callback", pipeline(parseForm)(
    social.callback("apple", { onSuccess: /* same as above */, onError: /* … */ }),
  )),
]
```

### Notes that bite people

- **Apple**: the `privateKey` is the PEM of the `.p8` you downloaded from
  Apple. `mintClientSecret` runs on every exchange — TTL is 15 minutes; no
  caching is needed for normal traffic. The callback is a `POST` because the
  default `response_mode` is `form_post`.
- **GitHub**: if `user:email` scope is granted but the primary email is
  private, the provider falls back to `GET /user/emails` automatically.
- **Facebook**: scopes are comma-joined (not space-joined). The package handles
  that for you, but if you pass `extraParams` keep it in mind.
- **Twitter/X**: public PKCE-only clients leave `clientSecret` undefined.
  Confidential clients pass it; the package switches to HTTP Basic auth on
  the token endpoint automatically. Twitter does not return an email; treat
  the profile email as always `null`.
- **TikTok**: the dashboard calls it `client_key`, not `client_id`. The stable
  user id is `open_id`. Email is never returned.
- **Cookie in HTTPS-only browsers**: `Secure` is on by default. If you're
  running over plain HTTP on something other than `localhost`, pass
  `cookie: { secure: false }` or your browser will silently drop the cookie
  and every callback will fail with "Missing OAuth state cookie".

---

## Sharing a link (Twitter/X, Facebook, LinkedIn, Reddit, WhatsApp, Telegram, SMS, email)

`@atlas/share` builds the URL the user's browser opens to share to each
channel. URL builders are **pure**: no DOM, no fetch — call them on the
server while rendering, or in a React component, doesn't matter.

```ts
import { share, shareUrl, listChannels, shareEmail } from "@atlas/share"

const content = {
  url: "https://example.com/post/123",
  title: "Look at this",
  text: "A short blurb",
  hashtags: ["atlas", "bun"], // twitter
  via: "atlas",                // twitter
}

shareUrl("twitter", content)
// → https://twitter.com/intent/tweet?url=…&text=…&hashtags=atlas%2Cbun&via=atlas

share(content)
// → { twitter, facebook, linkedin, reddit, whatsapp, telegram, sms, email }

// Render a row of "share to X" buttons from the registry:
listChannels()
// → [{ channel: "twitter", label: "X (Twitter)" }, … ]
```

### Server-side share-by-email

Pair with `@atlas/email`. Falls back to the console transport in dev like
every other Atlas email path, so it's safe to wire before configuring a
sending domain.

```ts
import { createEmailer } from "@atlas/email"
import { shareEmail } from "@atlas/share"

const emailer = createEmailer({
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.RESEND_FROM,
})

await shareEmail({
  emailer,
  to: "friend@example.com",
  replyTo: "wess@example.com",   // so replies go to the sharer, not no-reply
  sharerName: "Wess",
  product: "Atlas",
  message: "thought you'd like this",
  content: { url: "https://example.com/post/123", title: "Look at this" },
})
```

Use `renderShareEmailMessage(opts)` if you want to preview the
`{ subject, html, text }` without sending. Untrusted strings are HTML-escaped
automatically; the body is wrapped in `@atlas/email`'s 560px Outlook-safe
card via `layout()`.
