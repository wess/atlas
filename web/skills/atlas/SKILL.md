---
name: atlas
description: Entry point for building with Atlas (@wess/atlas), a functional Bun and TypeScript framework. Use whenever a project imports @wess/atlas or the user mentions Atlas, to pick the right module and the right skill before reading any docs.
---

# Atlas

Composable, functional Bun/TypeScript modules. Import from `@wess/atlas/<module>`.

## Load the one skill you need

| Task | Skill |
|---|---|
| New project, adding modules, env, running, deploying | `atlasproject` |
| HTTP routes, pipes, errors, WebSockets, SSE, security headers | `atlasserver` |
| Schemas, queries, validation, migrations | `atlasdb` |
| Passwords, JWTs, login, social sign-in, SSO, OAuth server, sessions | `atlasauth` |
| React, components, forms, tables, theming, client routing | `atlasui` |
| Generated admin panel | `atlasadmin` |
| Chat, embeddings, RAG, agents | `atlasai` |
| Storage, cache, email, push, payments, outbound HTTP, sharing | `atlasservices` |
| Changing Atlas itself | `atlascontributing` |

## Rules

- Functions and immutable data. No classes, and never mutate inputs.
- Bun and Web APIs first: `Bun.serve`, `Bun.file`, `Bun.password`, `fetch`. No dotenv, because Bun loads `.env`.
- Lowercase filenames with no dashes or underscores: `src/billing/index.ts`, not `src/billing-service.ts`.
- Biome only, no Prettier or ESLint.
- Web apps route with real paths through the History API. Never `#` routes or in-memory view state.
- An export that isn't in a skill or `atlas docs <module>` doesn't exist. Don't infer it from another framework.

## Spend fewer tokens

1. Answer from the loaded skill if you can.
2. Look up one symbol, not a whole file: `atlas docs server | grep -n -A4 createSseChannel`.
3. Read one module's reference when a skill doesn't cover it: `atlas docs <module>`. Run `atlas docs` to list them.
4. Don't load `docs/overview.md` or `llms-full.txt` unless the question is about architecture.
5. Don't read Atlas source in `node_modules` to learn an API; the references are shorter and canonical.

## Done means

Run the project's checks before saying work is finished: `bunx tsc --noEmit`, `bunx biome check .`, `bun test`.
