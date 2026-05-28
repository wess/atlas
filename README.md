# Atlas

Composable Bun/TypeScript packages for building APIs, full-stack apps, and CLI tools.

## What is Atlas

Atlas is an à la carte set of functional, minimal-dependency packages that snap together like Lego blocks. Pick what you need — config, database, HTTP server, auth, storage — and compose them into your app. Inspired by Elixir's ecosystem, idiomatic to TypeScript and Bun's native APIs.

No framework lock-in. No classes. Just functions and immutable data flowing through pipes.

## Install

Atlas is not on npm. Install it as a single bun package directly from this repo.

```bash
bun add github:wess/atlas
```

That lands the whole repo under `node_modules/atlas/`. Map each `@atlas/<pkg>`
import to its file via `tsconfig.json` `paths` (bun reads tsconfig paths at
runtime):

```json
{
  "compilerOptions": {
    "paths": {
      "@atlas/auth":        ["./node_modules/atlas/packages/auth/index.ts"],
      "@atlas/auth/social": ["./node_modules/atlas/packages/auth/social/index.ts"],
      "@atlas/cache":       ["./node_modules/atlas/packages/cache/index.ts"],
      "@atlas/cli":         ["./node_modules/atlas/packages/cli/index.ts"],
      "@atlas/config":      ["./node_modules/atlas/packages/config/index.ts"],
      "@atlas/db":          ["./node_modules/atlas/packages/db/index.ts"],
      "@atlas/edge":        ["./node_modules/atlas/packages/edge/index.ts"],
      "@atlas/email":       ["./node_modules/atlas/packages/email/index.ts"],
      "@atlas/mcp":         ["./node_modules/atlas/packages/mcp/index.ts"],
      "@atlas/migrate":     ["./node_modules/atlas/packages/migrate/index.ts"],
      "@atlas/oauth":       ["./node_modules/atlas/packages/oauth/index.ts"],
      "@atlas/request":     ["./node_modules/atlas/packages/request/index.ts"],
      "@atlas/security":    ["./node_modules/atlas/packages/security/index.ts"],
      "@atlas/server":      ["./node_modules/atlas/packages/server/index.ts"],
      "@atlas/server/ws":   ["./node_modules/atlas/packages/server/ws/index.ts"],
      "@atlas/server/sse":  ["./node_modules/atlas/packages/server/sse/index.ts"],
      "@atlas/share":       ["./node_modules/atlas/packages/share/index.ts"],
      "@atlas/sso":         ["./node_modules/atlas/packages/sso/index.ts"],
      "@atlas/storage":     ["./node_modules/atlas/packages/storage/index.ts"],
      "@atlas/ai":          ["./node_modules/atlas/packages/ai/index.ts"],
      "@atlas/admin":       ["./node_modules/atlas/packages/admin/index.ts"],
      "@atlas/ui":          ["./node_modules/atlas/packages/ui/index.ts"],
      "@atlas/ui/*":        ["./node_modules/atlas/packages/ui/*/index.tsx"]
    }
  }
}
```

Then import normally:

```ts
import { defineConfig, env } from "@atlas/config"
import { connect } from "@atlas/db"
import { serve, router, get, json } from "@atlas/server"
```

Bump atlas with `bun update atlas`. The resolved commit is pinned in `bun.lock`.

## Packages

| Package | Description | External deps |
|---------|-------------|---|
| `@atlas/config` | Typed environment variables and config resolution | none |
| `@atlas/db` | Query builder, schemas, changesets, drivers (Postgres/SQLite) | `zod` |
| `@atlas/migrate` | Database migration manager | none |
| `@atlas/server` | Bun.serve with Plug-inspired pipe system | none |
| `@atlas/edge` | TLS-terminating reverse proxy with built-in Let's Encrypt | none |
| `@atlas/auth` | Password hashing, JWT, session management, auth flows | none |
| `@atlas/security` | CSP/headers, rate limit, audit log, TOTP, revocable DB-backed sessions | none |
| `@atlas/oauth` | OAuth 2.1 server: PKCE, refresh rotation, device flow, RFC 8414 discovery | none |
| `@atlas/sso` | OIDC relying-party (Sign in with $IdP): discovery, PKCE, state, code exchange, id_token verify | none |
| `@atlas/email` | Provider-agnostic transport (Resend) + invite/reset templates | none |
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
curl -sL https://github.com/wess/atlas/archive/refs/heads/main.zip -o /tmp/atlas.zip
unzip -q /tmp/atlas.zip -d /tmp/atlas-expand
mv /tmp/atlas-expand/atlas-main ./atlas
rm -rf /tmp/atlas.zip /tmp/atlas-expand
```

Add to `package.json`:
```json
{
  "workspaces": ["atlas/packages/*"],
  "dependencies": {
    "@atlas/config": "workspace:*",
    "@atlas/db": "workspace:*",
    "@atlas/migrate": "workspace:*",
    "@atlas/server": "workspace:*",
    "@atlas/auth": "workspace:*"
  }
}
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

Run it:
```bash
bun server.ts
```

## Templates

Scaffold a new project with `atlas init --template <name>`:

| Template | Description |
|----------|-------------|
| `minimal` | Just server + config |
| `api` | REST API with db, auth, migrations |
| `edge` | App + TLS-terminating edge (replaces Caddy/nginx) |
| `fullstack` | API + React frontend |
| `admin` | API + admin panel |
| `worker` | Background job processor |
| `realtime` | WebSocket + SSE |
| `socialnetwork` | Users, posts, follows, likes, feeds, media, real-time |
| `cms` | Headless CMS with content types, publishing, webhooks |
| `ai` | Chatbot, RAG, agents, embeddings, streaming |

## Development

```bash
bun install
bun test
bun run lint
```

## For AI/LLM sessions

Atlas is structured so an AI session can ground itself with a small, predictable set of files:

- [`SOUL.md`](SOUL.md) — identity, hard "do nots", reading order. Read first.
- [`llms.txt`](llms.txt) — index of every doc and per-package `AGENTS.md`.
- `packages/<name>/AGENTS.md` — canonical per-package API (≤ 200 lines each).
- `docs/api.md`, `docs/cookbook.md`, `docs/overview.md`, `docs/quickstart.md`.

Reach them three ways: read the files directly, run `atlas docs <name>`, or
connect to `atlas mcp` and call the `docs.list` / `docs.read` tools.

## Philosophy

- **Functional** — no classes, immutable data, composition over inheritance
- **Minimal deps** — wrap Bun's native APIs, not external packages
- **Composable** — each package works independently or with others
- **AI-friendly** — clear APIs, good types, predictable patterns
- **No framework lock-in** — use what you need, combine with anything else
- **Bun-native** — idiomatic to Bun's APIs and philosophy

## License

MIT
