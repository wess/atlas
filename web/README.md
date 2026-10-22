# Atlas

Composable Bun/TypeScript packages for building APIs, full-stack apps, and CLI tools.

[Documentation](https://wess.io/atlas/) · [API reference](https://wess.io/atlas/docs/api/) · [Quick start](https://wess.io/atlas/docs/quickstart/)

## What is Atlas

Atlas is an à la carte set of functional, minimal-dependency packages that snap together like Lego blocks. Pick what you need — config, database, HTTP server, auth, storage — and compose them into your app. Inspired by Elixir's ecosystem, idiomatic to TypeScript and Bun's native APIs.

No framework lock-in. No classes. Just functions and immutable data flowing through pipes.

## Install

The modular release candidate is `0.4.3`. These GitHub release commands become available
once all release artifacts have been published.

```sh
bunx --package https://github.com/wess/atlas/releases/download/v0.4.3/wess-atlas-cli-0.4.3.tgz atlas add server config db/query db/postgres
```

The installer records exact GitHub release URLs and the dependency closure for
only the selected entry points. Public imports stay under `@wess/atlas`:

```ts
import { defineConfig, env } from "@wess/atlas/config"
import { connect } from "@wess/atlas/db/postgres"
import { column, defineSchema, from } from "@wess/atlas/db/query"
import { serve, get, json } from "@wess/atlas/server"
```

`@wess/atlas` is a small facade with optional implementation peers such as
`@wess/atlas-server`. Installing the facade alone does not install implementations.
Use `atlas add` to select modules and their required peers; `atlas add` without
arguments lists the public entry points. No consumer path aliases or local Atlas
checkout are required. Keep application lockfiles and update the selected Atlas
libraries together.

To prepare and validate a release from this source workspace:

```sh
bun install --frozen-lockfile
bun run check
bun run typecheck
bun test
bun run distribution:build
bun run distribution:verify
bun run distribution:dryrun
```

Artifacts and the entry-point dependency catalog are written to
`out/distribution/`. The GitHub release contains those exact tarballs and their
integrity catalog. No npm publication or registry token is needed.

## Packages

For a clean production dependency tree, use
`bun install --production --omit=peer --frozen-lockfile`. The installer records the
selected module closure and required peers as explicit application dependencies.
Build browser assets first with development dependencies available. The release
fixture verifies that the minimal runtime excludes the CLI and frontend tooling.

| Package | Description | External deps |
|---------|-------------|---|
| `@wess/atlas/config` | Typed environment variables and config resolution | none |
| `@wess/atlas/db` | Query builder, schemas, changesets, drivers (Postgres/SQLite) | none |
| `@wess/atlas/migrate` | Database migration manager | none |
| `@wess/atlas/server` | Bun.serve with Plug-inspired pipe system | none |
| `@wess/atlas/edge` | TLS-terminating reverse proxy with built-in Let's Encrypt | none |
| `@wess/atlas/auth` | Password hashing, JWT, session management, auth flows | none |
| `@wess/atlas/security` | CSP/headers, rate limit, audit log, TOTP, revocable DB-backed sessions | none |
| `@wess/atlas/oauth` | OAuth 2.1 server: PKCE, refresh rotation, device flow, RFC 8414 discovery | none |
| `@wess/atlas/sso` | OIDC relying-party (Sign in with $IdP): discovery, PKCE, state, code exchange, id_token verify | none |
| `@wess/atlas/email` | Provider-agnostic transport (Resend) + invite/reset templates | none |
| `@wess/atlas/share` | Share-URL builders (socials, messengers, mailto) + server-side share-by-email | none |
| `@wess/atlas/storage` | S3-compatible object storage with presigned URLs | none |
| `@wess/atlas/cache` | Redis-backed caching with TTL and cache-aside patterns | none |
| `@wess/atlas/request` | HTTP client with retries, interceptors, provider configs | none |
| `@wess/atlas/cli` | CLI framework and Foreman process manager | none |
| `@wess/atlas/ui` | React + Mantine frontend blocks (forms, tables, auth UI) | `react`, `@mantine/*`, `@tanstack/*` |
| `@wess/atlas/admin` | Django-style auto-generated admin panel | `react`, `@mantine/*`, `@tanstack/*` |
| `@wess/atlas/mcp` | MCP server for AI/LLM debugging and introspection | none |
| `@wess/atlas/ai` | AI providers, chat, embeddings, RAG, agents, streaming | none |

## Quick Start

Build a user API with authentication in 60 lines.

```bash
mkdir myapp && cd myapp
bun init -y
bunx --package https://github.com/wess/atlas/releases/download/v0.4.3/wess-atlas-cli-0.4.3.tgz atlas add server config db/sqlite db/query migrate auth/flows auth/token
```

The example below uses public `@wess/atlas/<pkg>` exports from the selected libraries.

Create `.env`:
```
DATABASE_URL="sqlite:./app.db"
PORT=3000
SECRET="your-secret-key-here"
```

Create `schema.ts`:
```ts
import { defineSchema, column } from "@wess/atlas/db/query"

export const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  passwordHash: column.text(),
  createdAt: column.timestamp().defaultRaw("CURRENT_TIMESTAMP"),
})
```

Create `server.ts`:
```ts
import { defineConfig, env } from "@wess/atlas/config"
import { connect } from "@wess/atlas/db/sqlite"
import { migrate } from "@wess/atlas/migrate"
import { serve, router, pipeline, parseJson, json, get, post } from "@wess/atlas/server"
import { signup, login, requireAuth } from "@wess/atlas/auth/flows"
import * as token from "@wess/atlas/auth/token"

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
        table: "users",
        fields: ["email", "password"],
        onSuccess: (c, user) => json(c, 201, { id: user.id, email: user.email }),
      })
    )),
    post("/login", api(
      login({
        db,
        table: "users",
        identity: "email",
        password: "password",
        onSuccess: async (c, user) =>
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

## For agents

Atlas exposes one canonical documentation set through four transports:

- [`llms.txt`](https://wess.io/atlas/llms.txt) — concise, specification-shaped discovery index.
- [`llms-full.txt`](https://wess.io/atlas/llms-full.txt) — the complete guide and package corpus.
- [Agent guide](https://wess.io/atlas/docs/agents/) — grounding order, imports, package selection, MCP safety, and context budgets.
- `packages/<name>/AGENTS.md` — canonical per-package APIs, also published as page-level Markdown.

Read them from the repository or installed package, run `atlas docs <name>`, or connect to
`atlas mcp` and call `docs.list` / `docs.read`. Every documentation page advertises its
Markdown alternate and the covering `llms.txt` index.

## Philosophy

- **Functional** — no classes, immutable data, composition over inheritance
- **Minimal deps** — wrap Bun's native APIs, not external packages
- **Composable** — each package works independently or with others
- **AI-friendly** — clear APIs, good types, predictable patterns
- **No framework lock-in** — use what you need, combine with anything else
- **Bun-native** — idiomatic to Bun's APIs and philosophy

## License

MIT

♥ [Sponsor this project](https://github.com/sponsors/wess)
