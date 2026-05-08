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
