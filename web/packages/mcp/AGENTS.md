# @wess/atlas/mcp

MCP (Model Context Protocol) server exposing Atlas app internals as tools for AI/LLM debugging.

## Architecture

JSON-RPC over stdio with Content-Length framing (like LSP). No external dependencies.

## Key Exports

- `createMcpServer(tools, ctx)` — creates an MCP server with stdin/stdout transport
- `createContext(opts?)` — builds an `AtlasMcpContext` from optional service references; `allowWrites` (default false) lets `db.query` write
- `collectTools(ctx)` — returns tools based on what services are available in context
- `defineTool(tool)` — identity helper for defining a tool with type safety

## AtlasMcpContext

Holds optional references: `db`, `cache`, `routes`, `config`, `storage`, `migrationsDir`, `logBuffer`.
Tools auto-register based on which fields are present.

## Built-in Tools

| Tool | Requires | Description |
|------|----------|-------------|
| `db.query` | db | Read-only SQL (SELECT/WITH/EXPLAIN), returns rows as JSON. Postgres runs it as one statement in a `READ ONLY` transaction; SQLite under `PRAGMA query_only`. Writes need `allowWrites` |
| `db.schemas` | db | List tables and columns |
| `migrate.status` | db + migrationsDir | Show applied/pending migrations |
| `migrate.up` | db + migrationsDir | **Writes.** Run pending migrations |
| `migrate.down` | db + migrationsDir | **Writes.** Rollback last migration |
| `cache.get` | cache | Get value by key |
| `cache.set` | cache | **Writes.** Set value with optional TTL |
| `cache.del` | cache | **Writes.** Delete a key |
| `cache.flush` | cache | **Writes.** Flush all entries |
| `routes.list` | routes | List HTTP routes |
| `config.show` | config | Show config (secrets redacted) |
| `storage.list` | storage | List files with optional prefix |
| `storage.presign` | storage | Generate presigned URL |
| `health.check` | (always) | Check service connectivity |
| `docs.list` | (always) | List every package reference, guide including `docs/agents.md`, and root documentation entry point |
| `docs.read` | (always) | Read one package, guide, or root documentation source; only names `docs.list` returns are accepted |
| `logs.tail` | logBuffer | Get recent log lines |

Write tools carry MCP `annotations` (`destructiveHint: true`) and a `WRITES:`
description prefix so clients can require confirmation; read tools carry
`readOnlyHint: true`. `createContext({ allowWrites: true })`, or
`ATLAS_MCP_ALLOW_WRITES=1` for `atlas mcp`, lets `db.query` run writes.

The `docs.*` tools are always present so an agent connected to an Atlas-built
app can self-introspect the framework — no web fetch required.

## Usage

### Programmatic

```ts
import { createContext, collectTools, createMcpServer } from "@wess/atlas/mcp"

const ctx = createContext({ db, cache, routes })
const tools = collectTools(ctx)
const server = createMcpServer(tools, ctx)
await server.start()
```

### CLI

```sh
atlas mcp
```

Or directly:

```sh
bun run packages/mcp/entry.ts
```

Environment variables: `DATABASE_URL`, `DATABASE_PATH`, `REDIS_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`.

## Types

- `McpServer = { start(): Promise<void>; stop(): void }`
- `AtlasMcpContext = { db?, cache?, routes?, config?, storage?, migrationsDir?, logBuffer? }`
- `Tool = { name; description; inputSchema; handler(input, ctx) → Promise<unknown> }`
- `ToolInput` — JSON-schema-shaped input descriptor

## Dependencies

Sibling packages are *optional* — pass only the services you want exposed:

- `@wess/atlas/db` — enables `db.*` and `migrate.*` tools
- `@wess/atlas/cache` — enables `cache.*` tools
- `@wess/atlas/server` — enables `routes.list`
- `@wess/atlas/config` — enables `config.show` (secrets redacted)
- `@wess/atlas/storage` — enables `storage.*` tools
- `@wess/atlas/migrate` — enables `migrate.up` / `migrate.down`

External: none. Pure JSON-RPC over stdio with Content-Length framing.

## Testing

```sh
bun test packages/mcp/
```

Stdio framing uses byte lengths and caps headers at 8 KiB and bodies at 1 MiB. Invalid JSON returns a parse error; ambiguous/oversized frames terminate the transport. `stop` cancels a pending stdin read. Configuration redaction covers nested arrays, credential URLs, non-string secrets, and circular objects. Exposing a service in the MCP context grants its tools access to that service, including SQL writes and migrations.
