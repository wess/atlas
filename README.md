# Atlas

Composable Bun/TypeScript packages for building APIs, full-stack apps, and CLI tools.

## What is Atlas

Atlas is an à la carte set of functional, minimal-dependency packages that snap together like Lego blocks. Pick what you need — config, database, HTTP server, auth, storage — and compose them into your app. Inspired by Elixir's ecosystem, idiomatic to TypeScript and Bun's native APIs.

No framework lock-in. No classes. Just functions and immutable data flowing through pipes.

## Packages

| Package | Description | External deps |
|---------|-------------|---|
| `@atlas/config` | Typed environment variables and config resolution | none |
| `@atlas/db` | Query builder, schemas, changesets, drivers (Postgres/SQLite) | `zod` |
| `@atlas/migrate` | Database migration manager | none |
| `@atlas/server` | Bun.serve with Plug-inspired pipe system | none |
| `@atlas/auth` | Password hashing, JWT, session management, auth flows | none |
| `@atlas/storage` | S3-compatible object storage with presigned URLs | none |
| `@atlas/cache` | Redis-backed caching with TTL and cache-aside patterns | none |
| `@atlas/request` | HTTP client with retries, interceptors, provider configs | none |
| `@atlas/cli` | CLI framework and Foreman process manager | none |
| `@atlas/ui` | React + Mantine frontend blocks (forms, tables, auth UI) | `react`, `@mantine/*`, `@tanstack/*` |
| `@atlas/admin` | Django-style auto-generated admin panel | `react`, `@mantine/*`, `@tanstack/*` |
| `@atlas/mcp` | MCP server for AI/LLM debugging and introspection | none |
| `@atlas/ai` | AI providers, chat, embeddings, RAG, agents, streaming | none |

## Quick Start

Build a user API with authentication in 60 lines.

```bash
bun add @atlas/config @atlas/db @atlas/migrate @atlas/server @atlas/auth
```

Create `.env`:
```
DATABASE_URL="sqlite:./app.db"
PORT=3000
SECRET="your-secret-key-here"
```

Create `schema.ts`:
```ts
import { defineSchema, column } from "@atlas/db"

export const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  passwordHash: column.text(),
  createdAt: column.timestamp().default("now()"),
})
```

Create `server.ts`:
```ts
import { defineConfig, env } from "@atlas/config"
import { connect } from "@atlas/db"
import { migrate } from "@atlas/migrate"
import { serve, router, pipeline, parseJson, json, get, post } from "@atlas/server"
import { signup, login, requireAuth, token } from "@atlas/auth"
import { users } from "./schema"

const config = defineConfig({
  database: env("DATABASE_URL"),
  port: env("PORT", { parse: Number, default: "3000" }),
  secret: env("SECRET"),
})

const db = connect({ driver: "sqlite", path: "./app.db" })
await migrate.up(db, "./migrations")

const api = pipeline(parseJson)

serve({
  port: config.port,
  routes: [
    post("/signup", api(
      signup({
        db,
        table: users,
        fields: ["email", "password"],
        onSuccess: (c, user) => json(c, 201, { id: user.id, email: user.email }),
      })
    )),
    post("/login", api(
      login({
        db,
        table: users,
        identity: "email",
        password: "password",
        onSuccess: (c, user) =>
          json(c, 200, { token: await token.sign({ id: user.id }, config.secret) }),
      })
    )),
    get("/me", pipeline(requireAuth({ secret: config.secret }))(
      (c) => json(c, 200, { id: c.assigns.auth.id })
    )),
  ],
})
```

Create migrations with:
```bash
bun run @atlas/migrate create migrations add_users
```

This generates `migrations/20260402_add_users/up.sql`:
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT now()
);
```

Run it:
```bash
bun server.ts
```

Test:
```bash
curl -X POST http://localhost:3000/signup \
  -H "content-type: application/json" \
  -d '{"email":"user@test.com","password":"secret"}'

curl -X POST http://localhost:3000/login \
  -H "content-type: application/json" \
  -d '{"email":"user@test.com","password":"secret"}'

curl -X GET http://localhost:3000/me \
  -H "authorization: Bearer <token>"
```

## Packages

### config

Typed environment variable loader that reads `.env` at startup.

```ts
import { defineConfig, env } from "@atlas/config"

const config = defineConfig({
  port: env("PORT", { parse: Number, default: "3000" }),
})
```

Fails fast if required vars are missing. No runtime re-reading.

### db

Fluent query builder + schema definitions + changesets + Postgres/SQLite drivers.

```ts
import { from, defineSchema, column, changeset } from "@atlas/db"

const users = defineSchema("users", { id: column.serial().primaryKey(), ... })

const query = from(users).where(q => q("email").equals("user@example.com")).select("id")
const result = await db.one(query)

const cs = changeset(users, { cast: ["email"], validate: { email: z.string().email() } })
const validated = cs({ email: "user@example.com" })
```

### migrate

Timestamped SQL migrations with up/down support.

```ts
import { migrate } from "@atlas/migrate"

migrate.create("./migrations", "add_users")
await migrate.up(db, "./migrations")
await migrate.status(db, "./migrations")
```

### server

Immutable Conn + pipes + router + WebSocket + SSE + adapter pattern. Build APIs functionally.

```ts
import { pipe, pipeline, router, serve, json, get, post } from "@atlas/server"
import { ws } from "@atlas/server/ws"
import { sse } from "@atlas/server/sse"

const logger = pipe(c => { console.log(c.method, c.path); return c })
const cors = pipe(c => putHeader(c, "access-control-allow-origin", "*"))

serve({
  port: 3000,
  routes: [
    get("/", pipeline(logger, cors)(c => json(c, 200, { ok: true }))),
    post("/users", pipeline(logger, cors, parseJson)(handler)),
  ],
})
```

### auth

Hash passwords, sign JWTs, manage sessions, prebuilt auth flows.

```ts
import { hash, verify, token, signup, login, requireAuth } from "@atlas/auth"

const hashed = await hash("password123")
const valid = await verify("password123", hashed)

const jwt = await token.sign({ userId: 1 }, secret)
const payload = await token.verify(jwt, secret)
```

### storage

S3-compatible uploads, downloads, presigned URLs. Zero external deps.

```ts
import { createStore, upload, download, presign } from "@atlas/storage"

const store = createStore({ endpoint: "http://localhost:9000", bucket: "files", ... })

await upload(store, { key: "avatars/1.jpg", body: file, contentType: "image/jpeg" })
const url = presign(store, "avatars/1.jpg", { expires: 3600 })
```

### cache

Redis-backed caching with TTL and cache-aside pattern.

```ts
import { createCache, cached, invalidate } from "@atlas/cache"

const cache = createCache({ url: process.env.REDIS_URL })

const getUser = cached(cache, "user", async (id) => {
  return await db.one(from(users).where(q => q("id").equals(id)))
}, { ttl: 600 })

const user = await getUser("1")
await invalidate(cache, "user", "1")
```

### request

HTTP client with retries, interceptors, and preconfigured providers.

```ts
import { request, createClient, github } from "@atlas/request"

const res = await request("https://api.example.com/data", { json: { name: "atlas" } })
const data = await res.json()

const gh = github({ token: process.env.GITHUB_TOKEN })
const repos = await gh.get("/user/repos").json()
```

### cli

CLI framework, Foreman process manager, and built-in commands: `atlas init`, `atlas add`, `atlas dev`, `atlas mcp`.

```ts
import { cli, command, flag, foreman } from "@atlas/cli"

cli("myapp", [
  command("serve", {
    flags: { port: flag("p", { type: "number", default: 3000 }) },
    run: ({ flags }) => startServer(flags.port),
  }),
])

await foreman({ web: "bun run server.ts", worker: "bun run worker.ts" })
```

Built-in commands:
- `atlas init` — scaffold a new Atlas project
- `atlas add <package>` — add an Atlas package to your project
- `atlas dev` — start development server with Foreman
- `atlas mcp` — launch the MCP server for AI/LLM debugging

### ui

React + Mantine frontend blocks (forms, tables, auth pages, file upload, nav, AI chat).

```tsx
import { AtlasProvider, AppShell } from "@atlas/ui/provider"
import { LoginPage } from "@atlas/ui/auth"
import { createTable, TextColumn } from "@atlas/ui/table"
import { ChatPanel, MessageList } from "@atlas/ui/ai"

// each block is independently importable
```

Blocks: `provider`, `forms`, `table`, `auth`, `storage`, `nav`, `cache`, `ai`.

### admin

Django-style admin panel that auto-generates CRUD UI and API from schemas.

```ts
import { admin, model } from "@atlas/admin"

const panel = admin({
  db,
  models: [
    model({ schema: users, searchFields: ["email", "name"] }),
    model({ schema: posts, readOnly: true }),
  ],
})

serve({ routes: panel.mount([]) })
```

Serves admin SPA at `/admin` with list, detail, create views, search, filters, bulk actions.

### mcp

MCP (Model Context Protocol) server for AI/LLM debugging and introspection. Exposes your app's database, routes, config, and logs to AI agents for interactive debugging sessions.

```ts
import { createMcpServer } from "@atlas/mcp"

const mcp = createMcpServer({
  db,
  routes: myRoutes,
  config,
})

mcp.start()
```

Launch via the CLI:
```bash
atlas mcp
```

Gives AI agents access to query your database, inspect routes, view config, and read logs — all through the standard MCP protocol.

### ai

AI providers, chat completions, embeddings, RAG pipelines, agents, and streaming. Zero external dependencies — uses provider REST APIs directly.

```ts
import { createProvider, chat, embed, rag, agent } from "@atlas/ai"

const openai = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY })

// Chat completion
const reply = await chat(openai, {
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
})

// Embeddings
const vectors = await embed(openai, {
  model: "text-embedding-3-small",
  input: ["search query"],
})

// RAG pipeline
const answer = await rag({
  provider: openai,
  model: "gpt-4o",
  query: "What is Atlas?",
  documents: myDocs,
})

// Agents
const codeAgent = agent({
  provider: openai,
  model: "gpt-4o",
  tools: [searchTool, executeTool],
  system: "You are a coding assistant.",
})

const result = await codeAgent.run("Fix the failing test")
```

Supports OpenAI, Anthropic, and custom providers. Streaming via `chatStream()` returns an async iterable.

## Templates

Scaffold a new project with `atlas init --template <name>`:

| Template | Description |
|----------|-------------|
| `minimal` | Just server + config |
| `api` | REST API with db, auth, migrations |
| `fullstack` | API + React frontend |
| `admin` | API + admin panel |
| `worker` | Background job processor |
| `realtime` | WebSocket + SSE |
| `socialnetwork` | Users, posts, follows, likes, feeds, media, real-time |
| `cms` | Headless CMS with content types, publishing, webhooks |
| `ai` | Chatbot, RAG, agents, embeddings, streaming |

```bash
atlas init myapp --template api
atlas init myapp --template fullstack
atlas init myapp --template ai
```

## Development

Install dependencies:
```bash
bun install
```

Run tests:
```bash
bun test
```

Run linter:
```bash
bun run lint
```

## Philosophy

- **Functional** — no classes, immutable data, composition over inheritance
- **Minimal deps** — wrap Bun's native APIs, not external packages
- **Composable** — each package works independently or with others
- **AI-friendly** — clear APIs, good types, predictable patterns, AGENTS.md reference cards
- **No framework lock-in** — use what you need, combine with anything else
- **Bun-native** — idiomatic to Bun's APIs and philosophy
