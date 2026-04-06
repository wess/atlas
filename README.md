# Atlas

Composable Bun/TypeScript packages for building APIs, full-stack apps, and CLI tools.

## What is Atlas

Atlas is an à la carte set of functional, minimal-dependency packages that snap together like Lego blocks. Pick what you need — config, database, HTTP server, auth, storage — and compose them into your app. Inspired by Elixir's ecosystem, idiomatic to TypeScript and Bun's native APIs.

No framework lock-in. No classes. Just functions and immutable data flowing through pipes.

## Install

Atlas is not on npm. Clone the repo and reference packages via `file:`:

```bash
git clone https://github.com/wess/atlas.git atlas
```

Add atlas as a workspace and reference the packages you need:

```json
{
  "workspaces": ["atlas/packages/*"],
  "dependencies": {
    "@atlas/config": "workspace:*",
    "@atlas/db": "workspace:*",
    "@atlas/server": "workspace:*",
    "@atlas/auth": "workspace:*"
  }
}
```

Then `bun install`. Add `atlas/` to your `.gitignore`.
```

## Claude Command

Atlas ships with a `/atlas` command for Claude Code that autonomously builds entire projects from a description.

### Install

Copy the command to your global Claude Code commands so it's available in any project:

```bash
mkdir -p ~/.claude/commands
curl -o ~/.claude/commands/atlas.md https://raw.githubusercontent.com/wess/atlas/main/.claude/commands/atlas.md
```

Or clone the repo and copy manually:

```bash
git clone https://github.com/wess/atlas.git
cp atlas/.claude/commands/atlas.md ~/.claude/commands/atlas.md
```

### Usage

From any project directory that has access to the atlas repo, run:

```
/atlas a task management API with teams, projects, and real-time updates
```

```
/atlas a blog platform with auth, markdown posts, and image uploads
```

```
/atlas a chatbot with RAG, document indexing, and a React frontend
```

The command runs fully autonomously — it plans the architecture, builds all files in parallel, verifies everything compiles, and delivers a summary of what was built and how to run it.

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
git clone https://github.com/wess/atlas.git atlas
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

## Philosophy

- **Functional** — no classes, immutable data, composition over inheritance
- **Minimal deps** — wrap Bun's native APIs, not external packages
- **Composable** — each package works independently or with others
- **AI-friendly** — clear APIs, good types, predictable patterns
- **No framework lock-in** — use what you need, combine with anything else
- **Bun-native** — idiomatic to Bun's APIs and philosophy

## License

MIT
