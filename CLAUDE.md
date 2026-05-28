# Atlas

Composable, functional Bun/TypeScript building blocks. No classes, no mutation, no Node.js alternatives.

## Usage

Atlas is not on npm. Consume it as a Bun workspace, pulled from
[github.com/wess/atlas](https://github.com/wess/atlas).

**Submodule (apps under git):**

```bash
git submodule add https://github.com/wess/atlas.git libs/atlas
git submodule update --init --recursive
```

`package.json`:

```json
{
  "workspaces": ["libs/atlas/packages/*"],
  "dependencies": {
    "@atlas/config": "workspace:*",
    "@atlas/db": "workspace:*",
    "@atlas/server": "workspace:*"
  }
}
```

Bump with `cd libs/atlas && git pull origin main`.

**Zip snapshot (one-offs):**

```bash
curl -sL https://github.com/wess/atlas/archive/refs/heads/main.zip -o /tmp/atlas.zip
unzip -q /tmp/atlas.zip -d /tmp/atlas-expand
mv /tmp/atlas-expand/atlas-main ./atlas
rm -rf /tmp/atlas.zip /tmp/atlas-expand
```

```json
{ "workspaces": ["atlas/packages/*"] }
```

Add `atlas/` to `.gitignore` for the zip approach (submodules are tracked by git).

## Bun Only

`bun <file>` | `bun test` | `bun install` | `Bun.serve()` | `bun:sqlite` | `Bun.sql` | `Bun.redis` | `Bun.file` | `Bun.password` | No dotenv (Bun loads .env).

## Packages

| Import | Purpose |
|--------|---------|
| `@atlas/config` | Typed env vars via `defineConfig`, `env` |
| `@atlas/db` | Query builder, schemas, changesets, Postgres/SQLite drivers |
| `@atlas/migrate` | Timestamped SQL migrations |
| `@atlas/server` | Pipe-based HTTP server, router, response helpers |
| `@atlas/edge` | TLS-terminating reverse proxy with built-in Let's Encrypt |
| `@atlas/server/ws` | WebSocket channels, rooms |
| `@atlas/server/sse` | Server-sent events |
| `@atlas/auth` | Password hashing, JWT, sessions, auth flow pipes |
| `@atlas/auth/social` | Pluggable OAuth-client social login (Google, GitHub, Apple, Microsoft, Facebook, X, TikTok) |
| `@atlas/security` | CSP/headers, rate limit, audit log, TOTP, DB-backed revocable sessions |
| `@atlas/oauth` | OAuth 2.1 server (PKCE, refresh rotation, device flow, discovery) |
| `@atlas/sso` | OIDC relying-party (Sign in with $IdP): discovery, PKCE, state, code exchange, id_token verify |
| `@atlas/email` | Provider-agnostic email transport + invite/reset templates |
| `@atlas/share` | Share-URL builders (Twitter/X, FB, LinkedIn, Reddit, WhatsApp, Telegram, SMS, mailto) + server-side share-by-email |
| `@atlas/storage` | S3-compatible storage, presigned URLs |
| `@atlas/cache` | Redis caching with TTL, cache-aside |
| `@atlas/request` | HTTP client, retries, interceptors |
| `@atlas/cli` | CLI framework, Foreman, scaffolding |
| `@atlas/ui/*` | React + Mantine blocks (provider/forms/table/auth/storage/nav/cache/ai) |
| `@atlas/admin` | Auto-generated CRUD admin from schemas |
| `@atlas/mcp` | MCP server for AI debugging |
| `@atlas/ai` | AI providers, chat, embeddings, RAG, agents, streaming |

Path aliases in `tsconfig.json` resolve `@atlas/*` to source during local dev. Subpath exports: `@atlas/server/ws`, `@atlas/server/sse`, `@atlas/auth/social`, `@atlas/ui/*`.

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
