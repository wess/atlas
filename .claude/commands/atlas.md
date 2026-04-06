Build a complete, working project using Atlas packages. Fully autonomous — no questions, no user input.

Idea: $ARGUMENTS

## Phase 0: Bootstrap Atlas

Check if the atlas repo is available locally:
1. Look for `../atlas/docs/api.md` or `./atlas/docs/api.md`
2. If not found, clone it: `git clone https://github.com/wess/atlas.git atlas`

This gives you both the API reference and the packages for `file:` dependencies.

## Phase 1: Plan

Read `docs/api.md` from the atlas repo. Pick packages, design schemas, routes, and file list. No interviews. Decide and go.

Conventions: all lowercase filenames, no dashes/underscores, `src/<feature>/index.ts`, functional only, no classes.

## Phase 2: Install

Add atlas as a workspace in the project's package.json and reference packages via `workspace:*`:

```json
{
  "workspaces": ["atlas/packages/*"],
  "dependencies": {
    "@atlas/server": "workspace:*",
    "@atlas/db": "workspace:*"
  }
}
```

Then run `bun install`.

Available packages: config, db, migrate, server, auth, storage, cache, request, cli, ui, admin, mcp, ai.

## Phase 3: Build

Launch parallel agents (subagent_type "oh-my-claudecode:executor") split by concern. Give each agent ONLY the plan items and API signatures relevant to their scope — not the full api.md. Scopes:

- **Foundation:** config, schemas, db, migrations, .env.example
- **Server:** routes, pipes, handlers, websockets/SSE
- **Features:** auth, storage, cache, AI — as needed
- **Frontend (if needed):** @atlas/ui + Bun HTML imports

Use foreman (`@atlas/cli`) for dev.ts when running multiple processes (api + web).

Real implementations only. No stubs, no TODOs.

## Phase 4: Verify

One agent (subagent_type "oh-my-claudecode:verifier") runs `bunx tsc --noEmit`, checks imports, fixes issues.

## Phase 5: Deliver

One paragraph: what was built, how to run it, env vars needed.

## Rules

- Zero user interaction
- Atlas + Bun only, functional, immutable, no classes
- Minimize token usage: plan agent reads api.md once, passes only relevant excerpts to build agents
- Use `workspace:*` references with `"workspaces": ["atlas/packages/*"]` in package.json
- Add `atlas/` to .gitignore in the generated project
