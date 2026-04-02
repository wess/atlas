# Atlas Package Reference

Complete reference for all Atlas packages. Use this when you need to remember an API or see what a package can do.

## @atlas/config

Typed environment variable loading with `.env` support.

**Install:**
```bash
bun add @atlas/config
```

**Core API:**
- `env(name, opts?)` — Read an env var with optional parsing and defaults
- `defineConfig(schema)` — Resolve all env refs into a frozen config object

**Minimal Example:**
```ts
import { defineConfig, env } from "@atlas/config"

const config = defineConfig({
  database: env("DATABASE_URL"),
  port: env("PORT", { parse: Number, default: "3000" }),
})

config.port // number
```

**Dependencies:** None

---

## @atlas/db

Query builder, schemas, changesets, Postgres/SQLite drivers.

**Install:**
```bash
bun add @atlas/db zod
```

**Core API:**

Query builder:
- `from(table)` — Start a query
- `.select(...cols)`, `.where(cb)`, `.join()`, `.orderBy()`, `.limit()`, etc. — Chain methods
- `.insert(data)`, `.update(data)`, `.del()` — Mutations
- `.toSql(dialect?)` — Compile to SQL with bind values

Schemas:
- `defineSchema(table, columns)` — Define table structure
- `column.serial()`, `.text()`, `.integer()`, `.timestamp()`, etc. — Column types
- `.primaryKey()`, `.unique()`, `.ref()`, `.default()` — Modifiers

Changesets:
- `changeset(schema, opts)` — Validate input against schema

Drivers:
- `connect(opts)` — Connect to Postgres or SQLite
- `db.execute(query)`, `db.one()`, `db.all()` — Execute queries
- `db.transaction(fn)` — Run in a transaction

**Minimal Example:**
```ts
import { connect, defineSchema, column, from, changeset } from "@atlas/db"
import { z } from "zod"

const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
})

const db = connect({ driver: "sqlite", path: "./app.db" })

await db.execute(
  from(users).insert({ email: "user@test.com" }).toSql("sqlite")
)

const user = await db.one(
  from(users).where(q => q("email").equals("user@test.com")).toSql("sqlite")
)

const validate = changeset(users, {
  cast: ["email"] as const,
  validate: { email: z.string().email() },
})
const result = validate({ email: "user@test.com" })
```

**Dependencies:** `zod` (validation)

---

## @atlas/migrate

Database migration manager for Postgres and SQLite.

**Install:**
```bash
bun add @atlas/migrate @atlas/db
```

**Core API:**
- `migrate.create(dir, name)` — Create a new timestamped migration folder
- `await migrate.up(db, dir)` — Run all pending migrations
- `await migrate.down(db, dir)` — Rollback the last migration
- `await migrate.status(db, dir)` — Check migration status

**Minimal Example:**
```ts
import { migrate } from "@atlas/migrate"
import { connect } from "@atlas/db"

const db = connect({ driver: "sqlite", path: "./app.db" })

migrate.create("./migrations", "create_users")

await migrate.up(db, "./migrations")

const statuses = await migrate.status(db, "./migrations")
console.log(statuses)
```

**Migration Structure:**
```
migrations/
  20260402_create_users/
    up.sql    # CREATE TABLE users (...)
    down.sql  # DROP TABLE users
  20260403_add_posts/
    up.sql
    down.sql
```

**Dependencies:** `@atlas/db`

---

## @atlas/server

Bun.serve wrapper with Plug-inspired pipe system.

**Install:**
```bash
bun add @atlas/server
```

**Core API:**

Conn:
- `Conn` — Immutable request/response object
- `assign(conn, data)` — Merge data into `conn.assigns`
- `halt(conn, status, body?)` — Stop pipeline, return response
- `putHeader(conn, key, value)` — Add response header

Pipes:
- `pipe(fn)` — Create a pipe from a function
- `pipeline(...pipes)(handler)` — Compose pipes
- `parseJson`, `parseForm`, `parseMultipart` — Body parsers

Router:
- `router(routes)` — Create router from `"METHOD /path"` map
- `serve(opts)` — Start server

Response:
- `json(conn, status, data)` — JSON response
- `text(conn, status, body)` — Text response
- `redirect(conn, location)` — Redirect
- `stream(conn, status, readable)` — Streaming response

**Minimal Example:**
```ts
import { serve, router, pipe, pipeline, parseJson, json } from "@atlas/server"

const logger = pipe(c => {
  console.log(`${c.method} ${c.path}`)
  return c
})

serve({
  port: 3000,
  routes: router({
    "GET /": pipe(c => json(c, 200, { ok: true })),
    "POST /users": pipeline(logger, parseJson)(
      pipe(c => json(c, 201, c.body))
    ),
  }),
})
```

**Dependencies:** None

---

## @atlas/auth

Authentication: password hashing, JWT, sessions, auth flows.

**Install:**
```bash
bun add @atlas/auth @atlas/db @atlas/server
```

**Core API:**

Primitives:
- `await hash(password)` — Argon2 hash (Bun.password)
- `await verify(password, hash)` — Check password
- `await token.sign(payload, secret, opts?)` — Create JWT
- `await token.verify(jwt, secret)` — Decode JWT
- `createMemoryStore()` — In-memory session store

Flows (all return pipes for `@atlas/server`):
- `signup({ db, table, fields, onSuccess })` — Registration
- `login({ db, table, identity, password, onSuccess })` — Login
- `requireAuth({ secret })` — JWT guard
- `passwordReset({ db, table, transport })` — Password reset

**Minimal Example:**
```ts
import { hash, verify, token, signup, login, requireAuth } from "@atlas/auth"
import { pipeline } from "@atlas/server"

const hashed = await hash("password123")
const ok = await verify("password123", hashed)

const jwt = await token.sign({ userId: 1 }, SECRET)
const payload = await token.verify(jwt, SECRET)

const signupPipe = signup({
  db,
  table: users,
  fields: ["email", "password"],
  onSuccess: (c, user) => json(c, 201, user),
})

const loginPipe = login({
  db,
  table: users,
  identity: "email",
  password: "password",
  onSuccess: (c, user) => json(c, 200, { token: jwt }),
})

const guard = requireAuth({ secret: SECRET })
```

**Dependencies:** `@atlas/db`, `@atlas/server`

---

## @atlas/storage

S3-compatible object storage with presigned URLs.

**Install:**
```bash
bun add @atlas/storage
```

**Core API:**
- `createStore(opts)` — Create store config
- `await upload(store, opts)` — PUT file to bucket
- `await download(store, key)` — GET file from bucket
- `await remove(store, key)` — DELETE file
- `await list(store, prefix?)` — List objects by prefix
- `presign(store, key, opts?)` — Generate presigned URL

**Minimal Example:**
```ts
import { createStore, upload, download, presign } from "@atlas/storage"

const store = createStore({
  endpoint: "http://localhost:9000",
  bucket: "mybucket",
  accessKey: "minioadmin",
  secretKey: "minioadmin",
})

await upload(store, { key: "avatars/1.jpg", body: file, contentType: "image/jpeg" })

const url = presign(store, "avatars/1.jpg", { expires: 3600 })

const response = await download(store, "avatars/1.jpg")

await remove(store, "avatars/1.jpg")
```

**Dependencies:** None

---

## @atlas/cache

Redis-backed caching with TTL and cache-aside pattern.

**Install:**
```bash
bun add @atlas/cache
```

**Core API:**
- `createCache({ url })` — Connect to Redis
- `createMemoryCache()` — In-memory cache (for testing)
- `await cache.set(key, value, { ttl? })` — Store with optional TTL
- `await cache.get(key)` — Retrieve value
- `await cache.del(key)` — Delete key
- `await cache.expire(key, seconds)` — Set expiration
- `cached(cache, prefix, fn, opts?)` — Cache-aside wrapper
- `await invalidate(cache, prefix, ...args)` — Bust cache

**Minimal Example:**
```ts
import { createMemoryCache, cached, invalidate } from "@atlas/cache"

const cache = createMemoryCache()

const getUser = cached(cache, "user", async (id) => {
  return await db.one(from(users).where(q => q("id").equals(id)))
}, { ttl: 600 })

const user = await getUser("1")
const cached = await getUser("1") // returns from cache

await invalidate(cache, "user", "1") // bust cache
```

**Dependencies:** None (Bun.redis built-in)

---

## @atlas/request

HTTP client with retries, interceptors, and preconfigured providers.

**Install:**
```bash
bun add @atlas/request
```

**Core API:**
- `await request(url, opts?)` — One-off request
- `createClient(opts)` — Create preconfigured client
- `client.get(path, opts?)`, `.post()`, `.put()`, `.patch()`, `.del()` — HTTP methods
- `await withRetry(fn, opts?)` — Retry wrapper with backoff
- Providers: `github()`, `stripe()`, `openai()`, `resend()` — Preconfigured clients

**Minimal Example:**
```ts
import { request, createClient, github } from "@atlas/request"

const res = await request("https://api.example.com/data", {
  method: "POST",
  json: { name: "atlas" },
})
const data = await res.json()

const api = createClient({
  baseUrl: "https://api.example.com",
  headers: { authorization: "Bearer token" },
})
const user = await api.get("/users/1").json()

const gh = github({ token: process.env.GITHUB_TOKEN })
const repos = await gh.get("/user/repos").json()
```

**Dependencies:** None

---

## @atlas/cli

CLI framework and Foreman process manager.

**Install:**
```bash
bun add @atlas/cli
```

**Core API:**

Commands:
- `flag(short, opts)` — Define a flag
- `command(name, opts)` — Define a command with flags and handler
- `cli(name, commands)` — Parse argv and route to command

Foreman:
- `await foreman(procs)` — Run processes concurrently from Procfile or object

**Minimal Example:**
```ts
import { cli, command, flag, foreman } from "@atlas/cli"

cli("myapp", [
  command("serve", {
    flags: { port: flag("p", { type: "number", default: 3000 }) },
    run: ({ flags }) => startServer(flags.port),
  }),
])

await foreman({
  web: "bun run server.ts",
  worker: "bun run worker.ts",
})
```

**Procfile:**
```
web: bun run server.ts
worker: bun run worker.ts
css: bun run --hot tailwind.ts
```

**Dependencies:** None

---

## @atlas/ui

React + Mantine frontend blocks (forms, tables, auth, storage, nav).

**Install:**
```bash
bun add @atlas/ui react react-dom @mantine/core @mantine/hooks @mantine/form \
         @tanstack/react-table @tanstack/react-form lucide-react
```

**Core API:**

Provider:
- `AtlasProvider` — Root Mantine wrapper
- `AppShell` — Layout with nav and header slots

Forms:
- `createForm(config)` — Hook returning form and submit handler
- `TextField`, `SelectField`, `SubmitButton` — Form inputs

Table:
- `createTable(config)` — Data table with sort/filter/pagination
- `TextColumn`, `DateColumn`, `ActionColumn` — Column types

Auth:
- `LoginPage`, `SignupPage`, `ResetPasswordPage` — Complete auth pages

Storage:
- `FileUpload` — File input with button
- `ImagePreview` — Image display

Nav:
- `NavLink`, `Sidebar`, `Breadcrumb` — Navigation components

Cache:
- `CacheInspector` — Table of cache entries
- `CacheStatus` — Connection and hit rate badge

**Minimal Example:**
```tsx
import { AtlasProvider, AppShell } from "@atlas/ui/provider"
import { LoginPage } from "@atlas/ui/auth"
import { createTable, TextColumn } from "@atlas/ui/table"

export function App() {
  return (
    <AtlasProvider>
      <AppShell>
        <LoginPage onSubmit={handleLogin} />
      </AppShell>
    </AtlasProvider>
  )
}
```

**Dependencies:** `react`, `@mantine/*`, `@tanstack/*`, `lucide-react`

---

## @atlas/admin

Django-style admin panel with auto-generated CRUD UI and API.

**Install:**
```bash
bun add @atlas/admin @atlas/db @atlas/server react react-dom @mantine/core \
         @mantine/hooks @mantine/form @tanstack/react-table lucide-react
```

**Core API:**
- `admin(config)` — Create admin from models
- `model(config)` — Define a model with search, filters, actions

Routes generated automatically:
- `GET /api/schema` — Model metadata
- `GET /api/{table}` — List (paginated, searchable, filterable)
- `GET /api/{table}/:id` — Get one
- `POST /api/{table}` — Create
- `PUT /api/{table}/:id` — Update
- `DELETE /api/{table}/:id` — Delete
- `POST /api/{table}/bulk` — Bulk actions

UI served at `GET {basePath}` with list, detail, create views.

**Minimal Example:**
```ts
import { admin, model } from "@atlas/admin"
import { defineSchema, column } from "@atlas/db"
import { serve, router } from "@atlas/server"

const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  name: column.text(),
})

const panel = admin({
  db,
  basePath: "/admin",
  models: [
    model({
      schema: users,
      searchFields: ["email", "name"],
      bulkActions: ["delete"],
    }),
  ],
})

serve({
  routes: panel.mount({ "GET /": ... }),
})
```

**Dependencies:** `@atlas/db`, `@atlas/server`, `react`, `@mantine/*`, `@tanstack/*`, `lucide-react`

---

## Quick Reference: What to Use When

| Task | Package |
|------|---------|
| Load env vars | `@atlas/config` |
| Build database queries | `@atlas/db` |
| Run migrations | `@atlas/migrate` |
| Create HTTP API | `@atlas/server` |
| Add auth (password, JWT) | `@atlas/auth` |
| Upload files | `@atlas/storage` |
| Cache data | `@atlas/cache` |
| Call external APIs | `@atlas/request` |
| Build CLI | `@atlas/cli` |
| Build React UI | `@atlas/ui` |
| Add admin panel | `@atlas/admin` |
