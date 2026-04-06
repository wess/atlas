Build a complete, working project using Atlas packages. Fully autonomous — no user input after this point.

The user's idea: $ARGUMENTS

## Reference

Read `docs/api.md` once — it has every Atlas export in one file. Only read individual `packages/<name>/AGENTS.md` if you need deep detail on a specific package's patterns.

## Phase 1: Plan

Decide which Atlas packages the idea needs. Design:
- Data model (schemas, relationships)
- Routes and API surface
- File structure: `src/<feature>/index.ts`, all lowercase, no dashes/underscores
- Environment variables needed

Keep the plan short. File list + one-line purpose each.

## Phase 1.5: Install

Install the required Atlas packages from GitHub:

```bash
bun add github:wess/atlas/packages/config github:wess/atlas/packages/db github:wess/atlas/packages/server
```

Run a single `bun add` with all needed packages. Only install what the plan calls for. Available packages: config, db, migrate, server, auth, storage, cache, request, cli, ui, admin, mcp, ai.

## Phase 2: Build

Launch parallel agents (subagent_type "oh-my-claudecode:executor") split by concern:

- **Foundation:** config, schemas, db setup, migrations, .env.example
- **Server:** routes, pipes, handlers, websockets/SSE if needed
- **Features:** auth, storage, cache, AI — whatever the idea requires
- **Frontend (if needed):** React components using @atlas/ui blocks

Each agent gets: the plan, `docs/api.md` contents, and their specific scope. They write real code, not stubs.

## Phase 3: Verify

One agent (subagent_type "oh-my-claudecode:verifier") checks:
1. All imports resolve to real Atlas exports (per docs/api.md)
2. File naming conventions (lowercase, no dashes)
3. No non-Atlas packages where Atlas has a solution
4. `bunx tsc --noEmit` passes
5. Fix issues directly, don't report back

## Phase 4: Deliver

Brief summary: what was built, which packages, how to run it, required env vars.

## Rules

- Never ask the user for input
- Atlas packages only, Bun only, functional only, no classes
- Immutable data, small files, real implementations
- Read `docs/api.md` not individual AGENTS.md files (unless deep detail needed on one package)
- Launch agents in parallel where work is independent
- Atlas is not on npm. Use git references (e.g. `"@atlas/server": "github:wess/atlas/packages/server"`) or `file:` for local dev
