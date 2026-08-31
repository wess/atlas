# Atlas Agent Guide

Atlas exposes the same documentation through the web, package files, the CLI, and MCP. Use the
smallest transport and context set that can answer the task.

## Fast Path

1. Fetch `https://wess.io/atlas/llms.txt`.
2. Read this guide and the reference for each package the task actually uses.
3. Use the API reference only when a signature is still unclear.
4. Load the architecture overview only for cross-package design decisions.
5. Run the repository checks before presenting generated code as complete.

Do not begin by loading every package reference. Atlas is intentionally composable; most changes
need two or three packages.

## Documentation Transports

| Transport | Entry point | Best use |
|---|---|---|
| Concise web index | `/atlas/llms.txt` | Discover the minimum relevant sources |
| Complete web context | `/atlas/llms-full.txt` | One-fetch offline indexing or large-context work |
| Page Markdown | `/atlas/docs/<name>/index.md` | Fetch one canonical guide or package reference |
| Search index | `/atlas/search.json` | Programmatic title, description, kind, and text search |
| Installed CLI | `atlas docs [name]` | Read package-local docs without network access |
| MCP | `atlas mcp` | Discover docs and inspect a running Atlas application |

Every documentation HTML page declares its Markdown alternate and the covering `llms.txt` file in
the document head.

## Import Rule

Atlas installs as one package:

```bash
bun add @wess/atlas
```

Use public subpath imports in generated consumer code:

```ts
import { defineConfig, env } from "@wess/atlas/config"
import { connect } from "@wess/atlas/db"
import { get, json, serve } from "@wess/atlas/server"
```

The shorter `@atlas/<package>` spelling appears in some repository examples. It requires the
`tsconfig.json` path aliases documented in the README. Do not emit it for a new consumer unless
that alias is already configured.

## Package Selection

| Need | Read first | Common companions |
|---|---|---|
| Environment and configuration | `config` | `server`, `db` |
| SQL, schemas, and validation | `db` | `migrate`, `admin` |
| HTTP routes and responses | `server` | `config`, `security` |
| Login and sessions | `auth` | `db`, `security`, `email` |
| Authorization server | `oauth` | `auth`, `security` |
| Sign in with an identity provider | `sso` | `auth`, `security` |
| Files and object storage | `storage` | `server`, `security` |
| Redis-backed state | `cache` | `server` |
| Outbound HTTP | `request` | `config` |
| TLS edge routing | `edge` | `server` |
| React application blocks | `ui` | `server`, `auth` |
| Generated administration | `admin` | `db`, `ui` |
| Chat, retrieval, or tool loops | `ai` | `request`, `server` |
| Runtime introspection | `mcp` | the services being exposed |
| Commands and scaffolding | `cli` | the packages in the generated template |

## Generation Contract

When writing Atlas code:

- Use functions and immutable values. Do not introduce classes or mutate inputs.
- Prefer Bun and Web APIs over compatibility packages.
- Import from `@wess/atlas/<package>` in consumer projects.
- Read each selected package's canonical reference before inventing an export.
- Derive database row types with `RowOf<typeof schema>`.
- Compose HTTP behavior with `pipeline()`; use `halt()` for deliberate short-circuiting.
- Use typed `route()` validation rather than parsing the same request body manually.
- Keep filenames lowercase with no dashes, underscores, or spaces.
- Put tests under `packages/<name>/test/` when changing Atlas itself.

If a requested export is absent from the package reference and API lookup, treat it as absent. Do
not infer an API from a neighboring framework or package.

## MCP Workflow

`atlas mcp` always exposes:

- `docs.list` to discover package, guide, and root documentation identifiers.
- `docs.read` to read one canonical source.
- `health.check` to report configured service connectivity.

Additional tools appear only when their service is present in the MCP context. Read-only
introspection includes schema, route, migration-status, cache-read, storage-list, and log-tail
operations. Migration, cache-write, cache-delete, cache-flush, and other state-changing tools must
be treated as mutations, not discovery.

Recommended sequence:

1. Call `docs.list`.
2. Read the references needed for the task.
3. Call `health.check` and read-only inspection tools.
4. Explain the intended mutation before invoking a state-changing tool.
5. Re-read the affected state after the mutation.

## Context Budgets

### Small

Use `llms.txt`, this guide, and one package reference.

### Feature

Add the quick start or API reference plus every package directly involved in the feature.

### Architecture

Add the overview and references for both sides of each package boundary.

### Complete

Use `llms-full.txt` only when building a local index, working offline after one fetch, or when the
available context can hold the full corpus. It duplicates the sources linked by `llms.txt`.

## Verification

Run checks in this order:

```bash
bun run check
bun run typecheck
bun test
```

For documentation work, also run:

```bash
bun run site:build
bun test site/test/site.test.ts
```

Generated code is not grounded until its imports exist, its package references agree with the
usage, and the relevant checks pass.
