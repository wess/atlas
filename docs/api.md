# Atlas API Reference

## @atlas/config
```
env(name, opts?) → EnvRef<T>          opts: { parse: (s)=>T, default: string }
defineConfig(schema) → Readonly<T>    resolves all EnvRef values, freezes
```

## @atlas/db
```
from(schema, alias?) → Chainable<RowOf<schema>>   typed Ecto-style chain
from(table: string, alias?) → Chainable<any>      dynamic / cross-table chain
  .select(...keys)         narrows row to Pick<Row, K>
  .where(cb) .join(t, on) .leftJoin(t, on) .innerJoin(t, on)
  .orderBy(col, dir?, nulls?) .groupBy(...cols) .having(cb)
  .limit(n) .offset(n) .distinct(...cols)
  .insert(data) .insertMany(data[]) .update(data) .del() .truncate(cascade?)
  .returning(...keys) .onConflict(spec) .cte(name, sub) .recursiveCte(name, sub)
  .toSql(dialect?) → SqlResult<Selected>
raw(sql, ...values) → Fragment
defineSchema(table, columns) → Schema<T>
column.serial() → number   .text() → string   .integer() → number
  .bigint() → bigint   .real() → number   .boolean() → boolean
  .timestamp() → Date  .json<T>() → T       .uuid() → string
  modifiers: .primaryKey() .unique() .nullable() (widens to T|null)
             .default(val) .ref(table, col)
RowOf<typeof schema>                             extract row TS type
changeset(schema, { cast, required?, validate? }) → (data) => ChangesetResult
connect({ driver, path|url, pool? }) → Connection
  Connection: .execute<Row>(q) → Row[]
              .one<Row>(q) → Row | null
              .all<Row>(q) → Row[]
              .transaction(fn) .close()
              row type is inferred from the chain when from(schema) is used
```

## @atlas/migrate
```
migrate.create(dir, name)            creates timestamped up.sql/down.sql
migrate.up(db, dir)                  runs pending migrations
migrate.down(db, dir)                rolls back last migration
migrate.status(db, dir)              lists migration status
migrate.plan(db, schemas) → DiffPlan       compute up/down SQL (read-only)
migrate.diff(db, schemas, { name?, dir? }) → DiffWriteResult
                                     introspect live DB, write a new migration
                                     folder with up/down SQL — { noop: true }
                                     when in sync. Type/nullability mismatches
                                     emit `-- ALTER` comments for review.
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

route(method, path, schemas, handler) → Route        validated, typed route
getR | postR | putR | patchR | delR(path, schemas, handler) → Route
  schemas: { params?, body?, query?, before?, assigns? }
  - params/body/query: Validator<T> = (input) => T  |  { parse(input): T }
    (Zod, plain functions, or any Standard-Schema-shape qualify)
  - before: PipeFn[] (run ahead of validation; e.g., requireAuth)
  - assigns: phantom — `{} as MyClaims` types c.assigns for the handler
  body schema auto-parses JSON; rejects non-application/json content-types.
  validation failures → unprocessable("Invalid <where>", VALIDATION_FAILED)

httpError(status, message, { code?, details?, headers? }) → HttpError
isHttpError(value) → bool                            type guard
haltWith(conn, error) → Conn                         halt with HttpError
notFound | unauthorized | forbidden | badRequest | conflict | gone |
unprocessable | tooManyRequests | methodNotAllowed | internal |
serviceUnavailable(message?, opts?) → HttpError
  router catches `throw httpError(...)` and renders { error, code?, details? }
```

## @atlas/edge
```
defineEdge(config) → { ...config, listen() → Promise<RunningEdge> }
runEdge(config) → Promise<RunningEdge>          { mode: "tls"|"plain", stop() }
proxy(upstream, { preserveHost? }) → EdgeHandler   reverse proxy with X-Forwarded-*
forward(req, options, ctx) → Promise<Response>     low-level proxy primitive
files({ root, index?, stripPrefix? }) → EdgeHandler   static file serving via Bun.file
compressResponse(res, accept, allow) → Response    apply gzip/zstd
matchHost(host, pattern) → bool                    literal or "*.x.com"
matchRoute(req, url, matcher?) → bool              path (regex|string|*) + method
isLocalHost(host) → bool                           localhost / 127.0.0.1 / ::1 / *.localhost

provisionCertificate({ directoryUrl, accountKey, contactEmail, hosts, challenge }) → { certPem, keyPem }
generateKeyPair() → AcmeKeyPair                    ECDSA P-256 via Web Crypto
importKeyPair(jwk) | jwkThumbprint(jwk)
LETSENCRYPT_PROD | LETSENCRYPT_STAGING             directory URLs

issueCert({ directoryUrl, contactEmail, hosts, store, challenge }) → CertRecord
loadOrCreateAccount(store) → AcmeKeyPair
fileStore(root) | memoryStore() → CertStore       .load .save .loadAccountJwk .saveAccountJwk
certKey(hosts) → string                            stable map key for a host list
createRenewalScheduler(onRenew) → { schedule, cancel, stop }
renewAt(record) → number                           unix ms; 30 days before expiry, clamped

EdgeConfig: { acme?, sites: Site[], insecure?, httpPort?, httpsPort? }
Site: { host, routes: Route[], compress?: ("gzip"|"zstd")[] }
Route: { match?: { path?, method? }, handler: (req, ctx) => Promise<Response> }
ForwardContext: { remoteIp, tls, host }
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

## @atlas/email
```
createEmailer({ apiKey?, from? }) → Emailer    auto-picks Resend if both set, else console
createResendEmailer({ apiKey, from }) → Emailer
createConsoleEmailer() → Emailer               dev fallback; logs and returns ok:true
Emailer: { enabled, send(msg) → Promise<SendResult> }
EmailMessage: { to, subject, html, text?, replyTo?, from? }
SendResult: { ok: true, id?, logged? } | { ok: false, error }
inviteEmail(opts) | passwordResetEmail(opts) → { subject, html, text }
layout({ title, body, brand?, footer?, accent? }) → string
escapeHtml(s) → string                          always wrap untrusted input
```

## @atlas/oauth
```
oauthRoutes(cfg, { basePath?, adminBasePath? }) → Route[]   all OAuth endpoints
oauthAuthorizeRoutes(cfg, base) | oauthTokenRoutes | oauthRevokeRoutes
oauthDeviceRoutes | oauthDiscoveryRoutes | oauthClientRoutes(cfg, adminBase)
findClient(db, id) | verifyClientCredentials(db, id, secret)
sweepExpired(db) | sweepExpiredAuthCodes | sweepExpiredRefreshTokens | sweepExpiredDeviceCodes
helpers: parseScope, formatScope, includesScopes, isAllowedRedirect,
         verifyPkceS256, randomId, shortId, sha256, newUserCode, normalizeUserCode
constants: ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS,
           AUTH_CODE_TTL_SECONDS, DEVICE_CODE_TTL_SECONDS, DEVICE_POLL_INTERVAL_SECONDS
types: OAuthConfig, OAuthUser, ClientRow, AuthCodeRow, RefreshTokenRow,
       DeviceCodeRow, OAuthAuditEvent, RequestContext
```

## @atlas/security
```
withSecurityHeaders(fetch, { dev?, csp?, disableCsp? }) → fetch     HSTS/CSP/COOP/CORP + req.peerIp shim
developmentCsp | productionCsp                                       string CSP presets
decideInline(mime, name, wantInline) → { contentType, disposition }  safe-MIME allowlist for inline
createDbRateLimit({ db }) | createMemoryRateLimit() → RateLimit      .check(bucket, max, windowSec)
clientIp(req, { trustedProxies? }) → string                          honors X-Forwarded-For only via trusted proxy
userAgent(req) → string | undefined
parseTrustedProxies(env) → string[]
createAuditLogger({ db }) → { log(event), ... }                      fire-and-forget; never throws
createSessionStore<U>({ db, secret, ttlSeconds }) → SessionStore     DB-backed JWT sessions
  .issue(user, ctx) .isActive(jti) .touch(jti) .revoke(jti, userId) .revokeAll(userId, keep?) .sweepExpired()
newJti() → string
generateSecret() → string                       TOTP base32 secret
totpAt(secret, epochSec) → string               6-digit code at time
verifyTotp(secret, code, { window? }) → bool    window=1 accepts ±30s
otpauthUrl({ secret, account, issuer }) → string
generateBackupCodes(n?) → string[]              store hashed
base32Encode(bytes) | base32Decode(str)
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
initCommand | addCommand | docsCommand   built-in atlas commands
questions | applyDefaults | generateProject   scaffolding

CLI surface:
  atlas init [-y] [-n name]            scaffold a new project
  atlas add <pkg>...                   install @atlas/* packages
  atlas dev                             foreman → Procfile
  atlas mcp                             start MCP server
  atlas docs [<pkg>|<doc>]             print AGENTS.md / docs to stdout
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

Always-on tools (independent of context):
  docs.list                    list every package's AGENTS.md + docs/*.md
  docs.read({ package?, doc? }) read packages/<pkg>/AGENTS.md or docs/<name>.md
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
