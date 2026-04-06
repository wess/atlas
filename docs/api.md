# Atlas API Reference

## @atlas/config
```
env(name, opts?) → EnvRef<T>          opts: { parse: (s)=>T, default: string }
defineConfig(schema) → Readonly<T>    resolves all EnvRef values, freezes
```

## @atlas/db
```
from(table|schema, alias?) → Chain   entry point for queries
  .select(...cols) .distinct(...cols) .where(cb) .join(t, on) .leftJoin(t, on)
  .orderBy(col, dir?, nulls?) .groupBy(...cols) .having(cb) .limit(n) .offset(n)
  .insert(data) .insertMany(data[]) .update(data) .del() .truncate(cascade?)
  .returning(...cols) .onConflict(spec) .cte(name, sub) .toSql(dialect?)
raw(sql, ...values) → Fragment
defineSchema(table, columns) → Schema
column.serial() .text() .integer() .bigint() .real() .boolean() .timestamp() .json() .uuid()
  modifiers: .primaryKey() .unique() .nullable() .default(val) .ref(table, col)
changeset(schema, { cast, required?, validate? }) → (data) => ChangesetResult
connect({ driver, path|url, pool? }) → Connection
  Connection: .execute(q) .one(q) .all(q) .transaction(fn) .close()
```

## @atlas/migrate
```
migrate.create(dir, name)            creates timestamped up.sql/down.sql
migrate.up(db, dir)                  runs pending migrations
migrate.down(db, dir)                rolls back last migration
migrate.status(db, dir)              lists migration status
```

## @atlas/server
```
createConn(req, params?) → Conn      immutable connection from Request
assign(conn, data) → Conn            merge into conn.assigns
putHeader(conn, key, val) → Conn     add response header
halt(conn, status, body?) → Conn     stop pipeline
setStatus(conn, status) → Conn
pipe(fn) → PipeFn                    type-inference wrapper
pipeline(...pipes)(handler) → PipeFn compose pipes, halt short-circuits
get|post|put|patch|del|head|options(path, handler) → Route
router(...routes) → fetch handler
serve({ port, routes, hostname?, websocket? })
json(conn, status, data) → Conn
text(conn, status, body) → Conn
redirect(conn, location, status?) → Conn
stream(conn, status, readable) → Conn
parseJson | parseForm | parseMultipart   built-in parser pipes
onError(handler) → error pipe
createAdapter(name, start) → ServerAdapter
compose(adapters) → ComposedServer
```

## @atlas/server/ws
```
ws(config) → { handler, rooms, upgrade }
channel(name, handlers) → Channel
createRooms() → { join, leave, broadcast, members }
WsConn<T>: wrapped ws with auto-JSON send
```

## @atlas/server/sse
```
createSseChannel() → { broadcast, pipe, clients }
eventStream(conn, generator) → SSE response
SseClient: { id, send, close }
```

## @atlas/auth
```
hash(password) → Promise<string>           Argon2id via Bun.password
verify(password, hashed) → Promise<bool>
token.sign(payload, secret, opts?) → jwt   opts: { expiresIn: seconds }
token.verify(jwt, secret) → payload
createMemoryStore() → SessionStore         dev/testing session store
signup({ db, table, fields, onSuccess }) → PipeFn
login({ db, table, identity, password, onSuccess }) → PipeFn
requireAuth({ secret }) → PipeFn           reads Bearer token, sets conn.assigns.auth
passwordReset({ db, table, transport }) → PipeFn
```

## @atlas/storage
```
createStore({ endpoint, bucket, region, accessKey, secretKey }) → Store
upload(store, { key, body, contentType }) → Promise
download(store, key) → Promise<Response>
list(store, prefix?) → Promise<ListResult>
remove(store, key) → Promise
presign(store, key, { expires?, method? }) → string
```

## @atlas/cache
```
createCache({ url }) → Cache               Redis-backed
createMemoryCache() → Cache                 in-memory for dev
cached(cache, prefix, fn, { ttl? }) → cached function
invalidate(cache, prefix, key) → Promise
```

## @atlas/request
```
request(url, opts?) → Promise<Response>     opts: { json, headers, method, ... }
createClient(baseUrl, opts?) → Client       Client: .get .post .put .patch .delete
withRetry(fn, { retries?, delay? })
github({ token }) | stripe({ key }) | openai({ key }) | resend({ key })  preconfigured clients
```

## @atlas/cli
```
cli(name, commands)                  run CLI with command definitions
command(name, { flags?, run })       define a command
flag(short, { type, default? })      define a flag
parseArgs(argv, flags) → ParsedArgs
foreman(procs) | parseProcfile(str)  process manager
initCommand | addCommand             built-in atlas commands
questions | applyDefaults | generateProject   scaffolding
```

## @atlas/ui
```
@atlas/ui/provider:  AtlasProvider, AppShell
@atlas/ui/forms:     createForm, TextField, SelectField, SubmitButton
@atlas/ui/table:     createTable, TextColumn, DateColumn, ActionColumn
@atlas/ui/auth:      LoginPage, SignupPage, ResetPasswordPage
@atlas/ui/storage:   FileUpload, ImagePreview
@atlas/ui/nav:       Sidebar, NavLink, Breadcrumb
@atlas/ui/cache:     CacheInspector, CacheStatus
@atlas/ui/ai:        ChatWindow, MessageBubble, PromptInput, AiSearch, GenerateButton
```

## @atlas/admin
```
admin({ db, models, auth? }) → { mount, routes }
model({ schema, searchFields?, readOnly?, bulkActions?, customActions? }) → ModelConfig
Components: AdminApp, AdminSidebar, Dashboard, ModelList, Detail, Create, FilterBuilder, QueryBuilder, BulkBar
```

## @atlas/mcp
```
createMcpServer({ db?, routes?, config? }) → McpServer
createContext(opts) → AtlasMcpContext
defineTool(name, description, schema, handler) → Tool
collectTools(...tools) → Tool[]
McpServer: .start() .stop()
```

## @atlas/ai
```
createProvider({ provider, key?, baseUrl? }) → AiProvider   provider: "openai"|"anthropic"|"ollama"
createConversation(system?) → Conversation
addMessage(conv, msg) → Conversation
send(provider, conv, content, opts?) → { conversation, response }
userMessage|assistantMessage|systemMessage|toolMessage(content) → Message
chatStream: provider.chatStream(opts) → AsyncIterable
collectStream(stream) → ChatResponse
streamToSse(stream) → ReadableStream
parseSSE(text) → events
embed(provider, inputs, opts?) → number[][]
cosineSimilarity(a, b) → number
createVectorStore() → { add, search, size }
generateJson<T>(provider, prompt, opts?) → T
tool(name, desc, schema) → ToolDefinition
index(rag, id, text) → Promise             rag: { ai, store, topK? }
query(rag, question) → { answer, sources }
runAgent({ ai, system?, tools, maxIterations? }, prompt) → result
withAi(provider) → PipeFn                  adds ai to conn.assigns
```
