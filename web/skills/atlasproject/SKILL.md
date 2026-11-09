---
name: atlasproject
description: Create and run Atlas projects. Use when scaffolding with atlas init, choosing a template, adding modules with atlas add, configuring env vars, running dev servers or migrations, or checking a project is ready to deploy.
---

# Atlas projects

## Get the CLI

Atlas ships from GitHub releases, not npm. Never add an npm token, a `file:` or `link:` path, or a source alias.

```sh
bun add -g https://github.com/wess/atlas/releases/download/v0.5.0/wess-atlas-cli-0.5.0.tgz
```

## Start

```sh
atlas init -n myapp -t api    # -y accepts defaults, omit -t for prompts
atlas add server config db/postgres db/query
atlas skills install          # put these skills in .claude/skills
```

| Template | What you get |
|---|---|
| `minimal` | One server file |
| `api` | REST API with auth and a database |
| `fullstack` | API plus a React frontend on Atlas UI |
| `admin` | API plus the admin panel |
| `realtime` | WebSocket rooms and SSE |
| `ai` | Chat, RAG, and agent routes |
| `worker` | Background jobs |
| `edge` | TLS reverse proxy |
| `socialnetwork`, `cms` | Fuller reference apps |

`atlas init` writes `.env` with fresh secrets and owner-only permissions (0600), so keep that file. Prefer a template over assembling from nothing.

## Modules

`atlas add <module>...` records exact versions of what you selected and everything it depends on. Import narrow paths so you load less at runtime: `auth/password`, `auth/token`, `auth/flows`, `auth/social`, `db/query`, `db/postgres`, `db/sqlite`, `db/changeset`. Run `atlas add` with no arguments to list them.

## Config

```ts
import { defineConfig, env } from "@wess/atlas/config"

export const config = defineConfig({
  port: env("PORT", { parse: Number, default: "3000" }),
  databaseUrl: env("DATABASE_URL"),
  secret: env("AUTH_SECRET", {
    parse: (value) => {
      if (value.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters")
      return value
    },
  }),
})
```

A missing variable with no default throws at startup.

## Commands

```sh
atlas dev                       # run the Procfile
atlas migrate up                # apply ./migrations using DATABASE_URL; also down, status, new <name>
atlas check                     # rejects local Atlas paths and legacy aliases
atlas docs [module]             # print a reference
atlas mcp                       # docs and runtime inspection over MCP; db.query is read-only unless ATLAS_MCP_ALLOW_WRITES=1
```

## Before deploying

```sh
atlas check
bun install --production --omit=peer --frozen-lockfile
```

Commit `bun.lock`. The app must install with no neighbouring Atlas checkout.
