# Atlas

Composable, functional Bun/TypeScript building blocks. No classes, no mutation, no Node.js alternatives.

## Usage

Consumers import public `@wess/atlas/<module>` entry points. The modular release
uses a thin facade and separately distributed implementation libraries. After the
release is published, use `bunx --package https://github.com/wess/atlas/releases/download/v0.4.2/wess-atlas-cli-0.4.2.tgz atlas add server db/postgres db/query`
to record only selected modules and their dependencies. See README.md for release
status and installation commands. Do not configure aliases into node_modules or
require a neighboring Atlas checkout.

Source development retains internal workspace aliases and relative imports.
`bun run distribution:build` emits the facade, rewrites implementation imports,
and packs all libraries under `out/distribution/`. `bun run distribution:verify`
checks packed installs with unrelated optional peers absent.

## Bun Only

`bun <file>` | `bun test` | `bun install` | `Bun.serve()` | `bun:sqlite` | `Bun.sql` | `Bun.redis` | `Bun.file` | `Bun.password` | No dotenv (Bun loads .env).

## Packages

| Import | Purpose |
|--------|---------|
| `@wess/atlas/config` | Typed env vars via `defineConfig`, `env` |
| `@wess/atlas/db` | Query builder, schemas, changesets, Postgres/SQLite drivers |
| `@wess/atlas/migrate` | Timestamped SQL migrations |
| `@wess/atlas/server` | Pipe-based HTTP server, router, response helpers |
| `@wess/atlas/edge` | TLS-terminating reverse proxy with built-in Let's Encrypt |
| `@wess/atlas/server/ws` | WebSocket channels, rooms |
| `@wess/atlas/server/sse` | Server-sent events |
| `@wess/atlas/auth` | Password hashing, JWT, sessions, auth flow pipes |
| `@wess/atlas/auth/social` | Pluggable OAuth-client social login (Google, GitHub, Apple, Microsoft, Facebook, X, TikTok) |
| `@wess/atlas/security` | CSP/headers, rate limit, audit log, TOTP, DB-backed revocable sessions |
| `@wess/atlas/oauth` | OAuth 2.1 server (PKCE, refresh rotation, device flow, discovery) |
| `@wess/atlas/sso` | OIDC relying-party (Sign in with $IdP): discovery, PKCE, state, code exchange, id_token verify |
| `@wess/atlas/email` | Provider-agnostic email transport + invite/reset templates |
| `@wess/atlas/share` | Share-URL builders (Twitter/X, FB, LinkedIn, Reddit, WhatsApp, Telegram, SMS, mailto) + server-side share-by-email |
| `@wess/atlas/storage` | S3-compatible storage, presigned URLs |
| `@wess/atlas/cache` | Redis caching with TTL, cache-aside |
| `@wess/atlas/request` | HTTP client, retries, interceptors |
| `@wess/atlas/cli` | CLI framework, Foreman, scaffolding |
| `@wess/atlas/ui/*` | React + Mantine blocks (provider/forms/table/auth/storage/nav/cache/ai) |
| `@wess/atlas/admin` | Auto-generated CRUD admin from schemas |
| `@wess/atlas/mcp` | MCP server for AI debugging |
| `@wess/atlas/ai` | AI providers, chat, embeddings, RAG, agents, streaming |

Path aliases in `tsconfig.json` resolve `@wess/atlas/*` to source during local dev. Subpath exports: `@wess/atlas/server/ws`, `@wess/atlas/server/sse`, `@wess/atlas/auth/social`, `@wess/atlas/ui/*`.

## Conventions

- All lowercase filenames, no dashes/underscores/spaces
- Structure: `src/<feature>/index.ts` not `src/feature-name.ts`
- Small focused files, one concern each
- Immutable data, return new objects
- Pipes compose via `pipeline()`, `halt()` short-circuits
- Zero external runtime deps except `zod` (in `@wess/atlas/db`) and React/Mantine (in `@wess/atlas/ui`, `@wess/atlas/admin`) — wrap Bun/Web APIs, not packages

## Scripts

- `bun test` — run suite (tests live in `packages/*/test/`)
- `bun run check` — biome lint + format check
- `bun run tidy` — biome auto-fix (format + lint + organize imports via `biome check --write`)
- biome only; no prettier, no eslint

## Examples & Templates

- `example/` — Chirp, a working Twitter-like demo (auth, posts, follows, likes); `bun run dev`
- `templates/` — 10 scaffolds: `minimal`, `api`, `edge`, `admin`, `realtime`, `ai`, `fullstack`, `worker`, `socialnetwork`, `cms`

## Reference (read in this order)

1. `SOUL.md` — AI session bootstrap (identity, hard "do nots", reading order). Read first if fresh.
2. `llms.txt` — index of every doc and per-package `AGENTS.md`.
3. `packages/<name>/AGENTS.md` — per-package API (exports, types, usage, deps). Read only the package(s) you need.
4. `docs/api.md` — condensed cross-package API lookup.
5. `docs/cookbook.md` — patterns/recipes that don't justify a package.
6. `docs/overview.md` — architecture deep-dive. Skip unless explicitly needed.

Do not load multiple docs speculatively. AGENTS.md per package is canonical.
`atlas docs <name>` prints any of these to stdout; `atlas mcp` exposes them
as `docs.list` / `docs.read` tools.
