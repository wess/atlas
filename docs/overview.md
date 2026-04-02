# Atlas: Architecture Overview

Atlas is a collection of composable, functional Bun/TypeScript packages for building APIs, full-stack applications, and CLI tools. This document describes the architecture, package relationships, and design philosophy.

## Dependency Graph

```
@atlas/config (foundation — typed env loading)
  ├── @atlas/db
  ├── @atlas/server
  ├── @atlas/storage
  └── @atlas/cli

@atlas/migrate (depends on @atlas/db)
@atlas/auth (depends on @atlas/db, @atlas/server)
@atlas/admin (depends on @atlas/db, @atlas/server)

@atlas/cache (optional, can use @atlas/config)
@atlas/request (standalone — no sibling deps)

@atlas/ui (frontend, optional browser-side usage)
```

Packages are shallow — max 1 level of dependencies on siblings. This keeps them lightweight and composable.

## Core Packages

### Config

`@atlas/config` is the foundation. It provides typed environment variable loading that reads `.env` at startup and produces a frozen, immutable config object.

```ts
const config = defineConfig({
  database: env("DATABASE_URL"),
  port: env("PORT", { parse: Number, default: "3000" }),
})
```

All other packages optionally depend on config or accept config values directly. No forced wiring.

### Database

`@atlas/db` is the largest package, with three layers:

1. **Query Builder** — Ecto-inspired fluent chains for SELECT, INSERT, UPDATE, DELETE, JOIN operations. Fully immutable, functional API.
2. **Drivers** — Uniform interface to Postgres (via `Bun.sql`) and SQLite (via `bun:sqlite`) with transaction support.
3. **Schemas & Changesets** — Type-safe table definitions and Zod-powered input validation.

```ts
const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
})

const query = from(users).where(q => q("email").equals("user@test.com"))
const result = await db.one(query)
```

### HTTP

`@atlas/server` wraps `Bun.serve` with a Plug-inspired pipe system. Requests flow through immutable `Conn` objects that pipes transform.

```ts
const logger = pipe(c => { console.log(c.method); return c })
const auth = pipe(c => {
  const token = c.headers.get("authorization")
  return token ? assign(c, { userId: decode(token).id }) : halt(c, 401)
})

serve({
  routes: router({
    "GET /users": pipeline(logger, auth)(handler),
  }),
})
```

Pipes are composable via `pipeline()`, which short-circuits on `halt()`. This approach is borrowed from Elixir and is more testable and readable than middleware.

### Auth

`@atlas/auth` provides:

- **Primitives** — `hash()`, `verify()`, `token.sign()`, `token.verify()` built on Bun's crypto
- **Flows** — Prebuilt pipes like `signup()`, `login()`, `requireAuth()`, `passwordReset()` that work with `@atlas/server` and `@atlas/db`

```ts
const signupPipe = signup({
  db,
  table: users,
  fields: ["email", "password"],
  onSuccess: (c, user) => json(c, 201, user),
})
```

### Storage

`@atlas/storage` provides S3-compatible object storage with:

- `upload()` — PUT file to bucket
- `download()` — GET file from bucket
- `presign()` — Generate presigned URLs for direct client access
- `list()` — List objects by prefix

Uses AWS Signature V4 (implemented from scratch, ~250 lines) with no external dependencies.

### Cache

`@atlas/cache` wraps `Bun.redis` with:

- `createCache()` — Redis-backed cache
- `createMemoryCache()` — In-memory (for testing)
- `cached()` — Cache-aside pattern: fetch from cache, fallback to function, store result
- `invalidate()` — Bust cache keys

```ts
const getUser = cached(cache, "user", async (id) => {
  return await db.one(from(users).where(q => q("id").equals(id)))
}, { ttl: 600 })
```

### Request

`@atlas/request` is an HTTP client built on `fetch` with:

- `request()` — One-off requests
- `createClient()` — Preconfigured clients with base URL, headers, retries
- Providers — Drop-in configs for GitHub, Stripe, OpenAI, Resend
- Retry logic with exponential backoff
- Request/response interceptors

```ts
const github = github({ token: process.env.GITHUB_TOKEN })
const repos = await github.get("/user/repos").json()
```

### CLI

`@atlas/cli` provides:

- **Command parser** — Define commands, flags, subcommands; parse argv
- **Foreman** — Procfile parser and concurrent process runner with colored output

```ts
cli("myapp", [
  command("serve", {
    flags: { port: flag("p", { type: "number", default: 3000 }) },
    run: ({ flags }) => startServer(flags.port),
  }),
])

await foreman({ web: "bun run server.ts", worker: "bun run worker.ts" })
```

### Migrate

`@atlas/migrate` manages timestamped SQL migrations with up/down support.

```ts
migrate.create("./migrations", "add_users")
await migrate.up(db, "./migrations")
await migrate.status(db, "./migrations")
```

Tracks applied migrations in `schema_migrations` table. Works with Postgres and SQLite.

### UI

`@atlas/ui` is a modular React + Mantine package with independent blocks:

- `@atlas/ui/provider` — Theme and layout shell
- `@atlas/ui/forms` — Form primitives and helpers
- `@atlas/ui/table` — Data tables with sort/filter/pagination
- `@atlas/ui/auth` — Login, signup, password reset pages
- `@atlas/ui/storage` — File upload and image preview
- `@atlas/ui/nav` — Navigation components
- `@atlas/ui/cache` — Cache inspector and status badge

Each block is independently importable and tree-shakeable.

### Admin

`@atlas/admin` auto-generates a Django-style admin panel from `@atlas/db` schemas. Provides:

- **API routes** — CRUD endpoints for each model
- **Admin SPA** — React UI with list, detail, create views, search, filters, bulk actions, custom actions, query builder
- **Metadata routes** — Schema introspection, field info, relation discovery

```ts
const panel = admin({
  db,
  models: [
    model({
      schema: users,
      searchFields: ["email", "name"],
      filterFields: ["status"],
      bulkActions: ["delete", "export"],
    }),
  ],
})

serve({ routes: panel.mount({ "GET /": ... }) })
```

Serves SPA at `/admin` with full CRUD UI.

## Composition Patterns

### Typical Backend App

```ts
// 1. Config
const config = defineConfig({ database: env("DATABASE_URL"), ... })

// 2. Database
const db = connect({ driver: "postgres", url: config.database })

// 3. Migrations
await migrate.up(db)

// 4. HTTP with pipes
serve({
  routes: router({
    "POST /auth/signup": signup({ db, table: users, ... }),
    "POST /auth/login": login({ db, table: users, ... }),
    "GET /api/users": pipeline(requireAuth)(listUsers),
    "POST /api/files": pipeline(requireAuth, parseMultipart)(uploadFile),
  }),
})
```

### Full Stack

Use `@atlas/ui` blocks on the client:

```tsx
// server.ts
import admin from "./admin.html" // HTML file that imports React SPA

serve({
  routes: router({
    "GET /admin": admin,
    "GET /admin/*": admin,
    ...apiRoutes,
  }),
})
```

```html
<!-- admin.html -->
<html>
  <body>
    <div id="root"></div>
    <script type="module" src="./admin.tsx"></script>
  </body>
</html>
```

```tsx
// admin.tsx
import { admin } from "@atlas/admin"
import { createRoot } from "react-dom/client"

const root = createRoot(document.getElementById("root")!)
root.render(<AdminApp />)
```

## AGENTS.md Convention

Each package includes an `AGENTS.md` at its root — a compact manifest (~80 lines) of the public API.

**Structure:**

- **Exports** — Each public function/type with signature and return type
- **Types** — Data shapes that users need to generate correct code
- **Usage** — Minimal working example
- **Dependencies** — Sibling and external packages

**Why this matters:**

LLMs can read `packages/db/AGENTS.md` instead of traversing 20+ source files. This is critical for token efficiency in prompt engineering and code generation workflows.

**Conventions:**

- Keep under 100 lines
- Every public export must be listed
- Include return types and argument types
- Update whenever the API changes
- Treat as part of the build process

## Design Philosophy

1. **Functional** — No classes, immutable data, composition over inheritance
2. **Minimal dependencies** — Wrap Bun's native APIs, don't reach for external packages
3. **Composable** — Each package works independently or with others
4. **AI/LLM-friendly** — Clear APIs, good types, predictable patterns, AGENTS.md reference
5. **No framework lock-in** — Use what you need, combine with anything else
6. **Bun-native** — Idiomatic to Bun's philosophy and APIs
7. **Shallow dependencies** — Max 1 level of sibling package dependencies

## External Dependencies

| Package | Deps |
|---------|------|
| config | none |
| db | `zod` |
| migrate | none |
| http | none |
| auth | none |
| storage | none |
| cache | none |
| request | none |
| cli | none |
| ui | `react`, `@mantine/*`, `@tanstack/*`, `lucide-react` |
| admin | `react`, `@mantine/*`, `@tanstack/*`, `lucide-react` |

Total: Only `zod` on the backend. Frontend uses React + Mantine + TanStack.

## Development Environment

- **Monorepo** — Bun workspaces
- **Testing** — `bun test` across all packages
- **TypeScript** — Strict mode
- **Linting** — ESLint (configurable per package)
- **File naming** — All lowercase, no dashes or underscores, subdirectories for organization
- **Environment** — `.env` in root (Postgres on localhost, SQLite in memory for tests)
