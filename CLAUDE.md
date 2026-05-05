# Atlas

Composable, functional Bun/TypeScript building blocks. No classes, no mutation, no Node.js alternatives.

## Usage

Atlas is a private repo, not on npm. Download and use as a workspace:

```bash
curl -sL https://github.com/wess/atlas/archive/refs/heads/main.zip -o /tmp/atlas.zip
unzip -q /tmp/atlas.zip -d /tmp/atlas-expand
mv /tmp/atlas-expand/atlas-main ./atlas
rm -rf /tmp/atlas.zip /tmp/atlas-expand
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

`bun <file>` | `bun test` | `bun install` | `Bun.serve()` | `bun:sqlite` | `Bun.sql` | `Bun.redis` | `Bun.file` | `Bun.password` | No dotenv (Bun loads .env).

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
| `@atlas/security` | CSP/headers, rate limit, audit log, TOTP, DB-backed revocable sessions |
| `@atlas/oauth` | OAuth 2.1 server (PKCE, refresh rotation, device flow, discovery) |
| `@atlas/email` | Provider-agnostic email transport + invite/reset templates |
| `@atlas/storage` | S3-compatible storage, presigned URLs |
| `@atlas/cache` | Redis caching with TTL, cache-aside |
| `@atlas/request` | HTTP client, retries, interceptors |
| `@atlas/cli` | CLI framework, Foreman, scaffolding |
| `@atlas/ui/*` | React + Mantine blocks (provider/forms/table/auth/storage/nav/cache/ai) |
| `@atlas/admin` | Auto-generated CRUD admin from schemas |
| `@atlas/mcp` | MCP server for AI debugging |
| `@atlas/ai` | AI providers, chat, embeddings, RAG, agents, streaming |

Path aliases in `tsconfig.json` resolve `@atlas/*` to source during local dev. Subpath exports: `@atlas/server/ws`, `@atlas/server/sse`, `@atlas/ui/*`.

## Conventions

- All lowercase filenames, no dashes/underscores/spaces
- Structure: `src/<feature>/index.ts` not `src/feature-name.ts`
- Small focused files, one concern each
- Immutable data, return new objects
- Pipes compose via `pipeline()`, `halt()` short-circuits
- Zero external runtime deps except `zod` (in `@atlas/db`) and React/Mantine (in `@atlas/ui`, `@atlas/admin`) — wrap Bun/Web APIs, not packages

## Scripts

- `bun test` — run suite (tests live in `packages/*/test/`)
- `bun run check` — biome lint + format check
- `bun run tidy` — biome auto-fix (format + lint)
- biome only; no prettier, no eslint

## Examples & Templates

- `example/` — Chirp, a working Twitter-like demo (auth, posts, follows, likes); `bun run dev`
- `templates/` — 9 scaffolds: `minimal`, `api`, `admin`, `realtime`, `ai`, `fullstack`, `worker`, `socialnetwork`, `cms`

## Reference (read in this order)

1. `packages/<name>/AGENTS.md` — per-package API (exports, types, usage, deps). Read only the package(s) you need.
2. `docs/api.md` — condensed cross-package API lookup.
3. `docs/cookbook.md` — patterns/recipes that don't justify a package.
4. `docs/overview.md` — architecture deep-dive. Skip unless explicitly needed.

Do not load multiple docs speculatively. AGENTS.md per package is canonical.
