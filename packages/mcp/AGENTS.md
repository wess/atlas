# @atlas/mcp

MCP (Model Context Protocol) server exposing Atlas app internals as tools for AI/LLM debugging.

## Architecture

JSON-RPC over stdio with Content-Length framing (like LSP). No external dependencies.

## Key Exports

- `createMcpServer(tools, ctx)` — creates an MCP server with stdin/stdout transport
- `createContext(opts?)` — builds an `AtlasMcpContext` from optional service references
- `collectTools(ctx)` — returns tools based on what services are available in context
- `defineTool(tool)` — identity helper for defining a tool with type safety

## AtlasMcpContext

Holds optional references: `db`, `cache`, `routes`, `config`, `storage`, `migrationsDir`, `logBuffer`.
Tools auto-register based on which fields are present.

## Built-in Tools

| Tool | Requires | Description |
|------|----------|-------------|
| `db.query` | db | Execute SQL, returns rows as JSON |
| `db.schemas` | db | List tables and columns |
| `migrate.status` | db + migrationsDir | Show applied/pending migrations |
| `migrate.up` | db + migrationsDir | Run pending migrations |
| `migrate.down` | db + migrationsDir | Rollback last migration |
| `cache.get` | cache | Get value by key |
| `cache.set` | cache | Set value with optional TTL |
| `cache.del` | cache | Delete a key |
| `cache.flush` | cache | Flush all entries |
| `routes.list` | routes | List HTTP routes |
| `config.show` | config | Show config (secrets redacted) |
| `storage.list` | storage | List files with optional prefix |
| `storage.presign` | storage | Generate presigned URL |
| `health.check` | (always) | Check service connectivity |
| `docs.list` | (always) | List Atlas docs sources (every package's AGENTS.md, plus docs/*) |
| `docs.read` | (always) | Read `packages/<name>/AGENTS.md` or `docs/<name>.md` |
| `logs.tail` | logBuffer | Get recent log lines |

The `docs.*` tools are always present so an AI agent connected to an Atlas-built
app can self-introspect the framework — no web fetch required.

## Usage

### Programmatic

```ts
import { createContext, collectTools, createMcpServer } from "@atlas/mcp"

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

- `McpServer = { start(): Promise<void>; stop(): Promise<void> }`
- `AtlasMcpContext = { db?, cache?, routes?, config?, storage?, migrationsDir?, logBuffer? }`
- `Tool = { name; description; inputSchema; handler(input, ctx) → Promise<unknown> }`
- `ToolInput` — JSON-schema-shaped input descriptor

## Dependencies

Sibling packages are *optional* — pass only the services you want exposed:

- `@atlas/db` — enables `db.*` and `migrate.*` tools
- `@atlas/cache` — enables `cache.*` tools
- `@atlas/server` — enables `routes.list`
- `@atlas/config` — enables `config.show` (secrets redacted)
- `@atlas/storage` — enables `storage.*` tools
- `@atlas/migrate` — enables `migrate.up` / `migrate.down`

External: none. Pure JSON-RPC over stdio with Content-Length framing.

## Testing

```sh
bun test packages/mcp/
```
