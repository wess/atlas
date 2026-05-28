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
  └── @atlas/auth/social (subpath — OAuth-client side: Google/GitHub/Apple/MS/FB/X/TikTok)
@atlas/admin (depends on @atlas/db, @atlas/server)
@atlas/security (depends on @atlas/db, @atlas/auth)
@atlas/oauth (depends on @atlas/db, @atlas/server, @atlas/auth)
@atlas/edge (standalone — no sibling deps)
@atlas/email (standalone — no sibling deps)
@atlas/share (depends on @atlas/email — share URL builders + server-side share-by-email)

@atlas/cache (optional, can use @atlas/config)
@atlas/request (standalone — no sibling deps)
@atlas/mcp (depends on @atlas/db, @atlas/server, @atlas/config)
@atlas/ai (standalone — no sibling deps, no external deps)

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

### Server

`@atlas/server` wraps `Bun.serve` with a Plug-inspired pipe system. Requests flow through immutable `Conn` objects that pipes transform.

Sub-modules:
- `@atlas/server` — Core HTTP routing with `get()`, `post()`, `put()`, `patch()`, `del()` route builders
- `@atlas/server/ws` — WebSocket support
- `@atlas/server/sse` — Server-Sent Events
- `@atlas/server/adapter` — Adapter pattern for deploying to different runtimes

```ts
const logger = pipe(c => { console.log(c.method); return c })
const auth = pipe(c => {
  const token = c.headers.get("authorization")
  return token ? assign(c, { userId: decode(token).id }) : halt(c, 401)
})

serve({
  routes: [
    get("/users", pipeline(logger, auth)(handler)),
  ],
})
```

Pipes are composable via `pipeline()`, which short-circuits on `halt()`. This approach is borrowed from Elixir and is more testable and readable than middleware.

### Edge

`@atlas/edge` is a TLS-terminating reverse proxy with built-in Let's Encrypt automation — the layer that would otherwise be Caddy or nginx in front of a Bun app.

- **ACME v2 client** — ECDSA P-256 account, JWS-signed requests, HTTP-01 challenge solver, hand-rolled CSR via a small DER encoder. No external deps.
- **Reverse proxy** — forwards requests with `X-Real-IP`, `X-Forwarded-For` (appended), `X-Forwarded-Proto`, `X-Forwarded-Host`. Hop-by-hop headers stripped. Host rewritten unless `preserveHost: true`.
- **Cert lifecycle** — certs persist to a configurable store (filesystem default, in-memory for tests). A renewal timer reissues 30 days before expiry and `server.reload({ tls })` swaps without dropping connections.
- **Localhost dev** — when every site host matches `isLocalHost`, the edge runs plain HTTP on a non-privileged port. No certs, no sudo. The same `edge.ts` runs in dev and prod.

```ts
import { defineEdge, proxy } from "@atlas/edge"

defineEdge({
  acme: { email: "you@example.com", storage: "/var/atlas/edge" },
  sites: [{
    host: process.env.DOMAIN!,
    compress: ["gzip", "zstd"],
    routes: [{ handler: proxy("http://app:3000") }],
  }],
}).listen()
```

The `templates/edge` scaffold ships a complete deploy pattern: Procfile for local, Dockerfile + compose.yaml for production, with the cert volume and ACME staging-then-prod recipe pre-wired.

### Auth

`@atlas/auth` provides:

- **Primitives** — `hash()`, `verify()`, `token.sign()`, `token.verify()` built on Bun's crypto
- **Flows** — Prebuilt pipes like `signup()`, `login()`, `requireAuth()`, `passwordReset()` that work with `@atlas/server` and `@atlas/db`
- **Social login** (`@atlas/auth/social` subpath) — pluggable OAuth-*client* for Google, GitHub, Apple, Microsoft, Facebook, X (Twitter), and TikTok. PKCE-S256 mandatory, state + verifier held in a signed HttpOnly cookie so the flow stays stateless. Your app owns the user table — `onSuccess` receives a normalized `SocialProfile` and you decide upsert/link.

```ts
const signupPipe = signup({
  db,
  table: users,
  fields: ["email", "password"],
  onSuccess: (c, user) => json(c, 201, user),
})

// Social — same Conn/PipeFn shape:
const social = socialAuth({
  secret,
  providers: {
    google: google({ clientId, clientSecret, redirectUri }),
    github: github({ clientId, clientSecret, redirectUri }),
    tiktok: tiktok({ clientKey, clientSecret, redirectUri }),
    // …apple, microsoft, facebook, twitter
  },
})
get("/auth/google", social.start("google"))
get("/auth/google/callback", social.callback("google", {
  onSuccess: async (c, { profile }) => json(c, 200, { profile }),
}))
```

### Security

`@atlas/security` ships hardening primitives most apps end up writing themselves:

- `withSecurityHeaders()` — strict default headers (HSTS, COOP/CORP, Permissions-Policy) and a CSP that defaults to `'self'`-only with no inline script in production. Also stashes the real Bun socket peer onto `req.peerIp` so downstream rate-limit / audit code does not have to trust client-supplied `X-Forwarded-For`.
- `createDbRateLimit()` / `createMemoryRateLimit()` — atomic UPSERT on Postgres, transactional read-modify-write on SQLite, in-memory for tests.
- `clientIp(req, { trustedProxies })` — only honors forwarded headers when the request actually arrived from a configured trusted proxy.
- `createSessionStore()` — DB-backed, revocable JWT sessions with `last_used_at` tracking and a sweep helper. Pair with `@atlas/auth#requireAuth`.
- `generateSecret` / `verifyTotp` / `otpauthUrl` / `generateBackupCodes` — pure `node:crypto` TOTP with backup codes.
- `decideInline()` — safe-MIME allowlist for `Content-Disposition: inline` (never inlines SVG).
- `createAuditLogger()` — fire-and-forget audit-event recorder; never throws, never blocks the response.

### OAuth

`@atlas/oauth` is an OAuth 2.1 server: PKCE-required authorization code, refresh-token rotation, device-code flow, RFC 8414 discovery, RFC 7009 revoke, and admin client management.

```ts
import { oauthRoutes } from "@atlas/oauth"

serve({
  routes: [
    ...oauthRoutes({ db, issuer: "https://auth.example.com", findUser, ... }),
    ...appRoutes,
  ],
})
```

`oauthRoutes(cfg)` returns every endpoint as a flat `Route[]` ready to spread into `serve`. Mount only what you need by calling the per-flow factories (`oauthAuthorizeRoutes`, `oauthTokenRoutes`, …) directly. Sweeps for expired auth codes / refresh tokens / device codes are exported separately so you can run them on a schedule.

### Email

`@atlas/email` is a provider-agnostic transport plus a small HTML shell and two stock templates.

```ts
import { createEmailer, inviteEmail } from "@atlas/email"

const emailer = createEmailer({ apiKey: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM })
await emailer.send({ to: "user@example.com", ...inviteEmail({ inviterName, product, signupUrl }) })
```

`createEmailer` returns the real Resend transport when both env vars are set and a console transport otherwise — dev environments stay unblocked without configuring a sending domain. `send` never throws; failures come back as `{ ok: false, error }`. The included `layout()` is a 560px Outlook-friendly card; always pass user-supplied strings through `escapeHtml`.

### Share

`@atlas/share` is the smallest practical layer for "share this link" UX. Pure URL builders for the eight channels users actually use, plus a server-side `shareEmail` that dispatches through any `@atlas/email` transport.

```ts
import { share, shareUrl, shareEmail } from "@atlas/share"

shareUrl("twitter", { url, title, hashtags: ["atlas"] })
// → https://twitter.com/intent/tweet?url=…&text=…&hashtags=atlas

share({ url, title, text })
// → { twitter, facebook, linkedin, reddit, whatsapp, telegram, sms, email }

await shareEmail({
  emailer,
  to: "friend@example.com",
  sharerName: "Wess",
  content: { url, title },
})
```

The URL builders have zero dependencies; `shareEmail` reuses the same `layout()` shell as `inviteEmail`/`passwordResetEmail` and escapes untrusted strings the same way.

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
- **Built-in commands** — `atlas init` (scaffold project), `atlas add` (add packages), `atlas dev` (start dev server), `atlas mcp` (launch MCP server)

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
- `@atlas/ui/ai` — Chat panel, message list, streaming display

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

serve({ routes: panel.mount([]) })
```

Serves SPA at `/admin` with full CRUD UI.

### MCP

`@atlas/mcp` provides a Model Context Protocol server for AI/LLM debugging and introspection. It exposes your app's database, routes, config, and logs to AI agents through the standard MCP protocol.

```ts
import { createMcpServer } from "@atlas/mcp"

const mcp = createMcpServer({
  db,
  routes: myRoutes,
  config,
})

mcp.start()
```

Launch via CLI: `atlas mcp`. AI agents can then query your database, inspect routes, view config, and read logs interactively.

### AI

`@atlas/ai` provides a unified interface for AI/LLM operations with zero external dependencies — it calls provider REST APIs directly via `fetch`.

- **Providers** — `createProvider({ provider, key })` returns an `AiProvider` for `"openai"`, `"anthropic"`, or `"ollama"`
- **Chat** — `provider.chat(opts)` for completions, `provider.chatStream(opts)` for streaming `StreamChunk`s
- **Conversations** — `createConversation`/`send` for immutable message-history tracking
- **Embeddings** — `embed(provider, inputs)` plus an in-memory `createVectorStore()`
- **RAG** — `index(rag, id, text)` + `query(rag, question)` over a `{ ai, store, topK? }` bag
- **Agents** — `runAgent({ ai, system?, tools, maxIterations? }, prompt)` for tool-using loops
- **Server pipe** — `withAi(provider)` attaches the provider to `conn.assigns.ai`

```ts
import { createProvider, send, createConversation, runAgent, tool } from "@atlas/ai"

const openai = createProvider({ provider: "openai", key: process.env.OPENAI_API_KEY! })

const conv = createConversation("You are a helpful assistant")
const { response } = await send(openai, conv, "Hello")

for await (const chunk of openai.chatStream({ messages: [{ role: "user", content: "Hi" }] })) {
  if (chunk.type === "text") process.stdout.write(chunk.content ?? "")
}
```

Works with OpenAI, Anthropic, Ollama, or any OpenAI-compatible endpoint (`baseUrl` override).

## Templates

Atlas ships with 10 project templates, scaffolded via `atlas init --template <name>`:

| Template | Description | Key Packages |
|----------|-------------|-------------|
| `minimal` | Just server + config | config, server |
| `api` | REST API with db, auth, migrations | config, db, migrate, server, auth |
| `edge` | App + TLS-terminating edge (replaces Caddy/nginx) | config, server, edge |
| `fullstack` | API + React frontend | config, db, server, auth, ui |
| `admin` | API + admin panel | config, db, server, auth, admin |
| `worker` | Background job processor | config, db, cache, cli |
| `realtime` | WebSocket + SSE | config, server |
| `socialnetwork` | Users, posts, follows, likes, feeds, media, real-time | config, db, server, auth, cache, storage |
| `cms` | Headless CMS with content types, publishing, webhooks | config, db, server, auth, storage, admin |
| `ai` | Chatbot, RAG, agents, embeddings, streaming | config, server, ai |

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
  routes: [
    post("/auth/signup", signup({ db, table: users, ... })),
    post("/auth/login", login({ db, table: users, ... })),
    get("/api/users", pipeline(requireAuth)(listUsers)),
    post("/api/files", pipeline(requireAuth, parseMultipart)(uploadFile)),
  ],
})
```

### Full Stack

Use `@atlas/ui` blocks on the client:

```tsx
// server.ts
import admin from "./admin.html" // HTML file that imports React SPA

serve({
  routes: [
    get("/admin", admin),
    get("/admin/*", admin),
    ...apiRoutes,
  ],
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
| server | none |
| auth | none |
| security | none |
| oauth | none |
| edge | none |
| email | none |
| share | none |
| storage | none |
| cache | none |
| request | none |
| cli | none |
| ui | `react`, `@mantine/*`, `@tanstack/*`, `lucide-react` |
| admin | `react`, `@mantine/*`, `@tanstack/*`, `lucide-react` |
| mcp | none |
| ai | none |

Total: Only `zod` on the backend. Frontend uses React + Mantine + TanStack.

## Development Environment

- **Monorepo** — Bun workspaces
- **Testing** — `bun test` across all packages
- **TypeScript** — Strict mode
- **Linting** — Biome (run `bun run check` / `bun run tidy`)
- **File naming** — All lowercase, no dashes or underscores, subdirectories for organization
- **Environment** — `.env` in root (Postgres on localhost, SQLite in memory for tests)
