# Atlas

Composable, functional Bun/TypeScript building blocks. No classes, no mutation, no Node.js alternatives.

## Usage

Atlas is a private repo, not on npm. Clone it and use as a workspace:

```bash
git clone https://github.com/wess/atlas.git atlas
```

```json
{
  "workspaces": ["atlas/packages/*"],
  "dependencies": {
    "@atlas/config": "workspace:*",
    "@atlas/db": "workspace:*",
    "@atlas/server": "workspace:*"
  }
}
```

Add `atlas/` to `.gitignore`.

## Bun Only

`bun <file>` | `bun test` | `bun install` | `Bun.serve()` | `bun:sqlite` | `Bun.sql` | `Bun.redis` | `Bun.file` | No dotenv (Bun loads .env).

## Packages

| Import | Purpose |
|--------|---------|
| `@atlas/config` | Typed env vars via `defineConfig`, `env` |
| `@atlas/db` | Query builder, schemas, changesets, Postgres/SQLite drivers |
| `@atlas/migrate` | Timestamped SQL migrations |
| `@atlas/server` | Pipe-based HTTP server, router, response helpers |
| `@atlas/server/ws` | WebSocket channels, rooms |
| `@atlas/server/sse` | Server-sent events |
| `@atlas/auth` | Password hashing, JWT, sessions, auth flow pipes |
| `@atlas/storage` | S3-compatible storage, presigned URLs |
| `@atlas/cache` | Redis caching with TTL, cache-aside |
| `@atlas/request` | HTTP client, retries, interceptors |
| `@atlas/cli` | CLI framework, Foreman, scaffolding |
| `@atlas/ui/*` | React + Mantine blocks (provider/forms/table/auth/storage/nav/cache/ai) |
| `@atlas/admin` | Auto-generated CRUD admin from schemas |
| `@atlas/mcp` | MCP server for AI debugging |
| `@atlas/ai` | AI providers, chat, embeddings, RAG, agents, streaming |

## Conventions

- All lowercase filenames, no dashes/underscores/spaces
- Structure: `src/<feature>/index.ts` not `src/feature-name.ts`
- Small focused files, one concern each
- Immutable data, return new objects
- Pipes compose via `pipeline()`, `halt()` short-circuits

## Reference

Each package has `packages/<name>/AGENTS.md` with full API docs.
Condensed reference: `docs/api.md` has all exports in one file.
