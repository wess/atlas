# Atlas API Reference

## Module selection

Public imports use `@wess/atlas/<module>`. `atlas add <module>...` installs the exact
coordinated Atlas libraries and external peers selected by the release catalog.
Use `/auth/password`, `/auth/token`, `/auth/session`, `/auth/flows`, `/auth/social`,
`/db/query`, `/db/postgres`, `/db/sqlite`, and `/db/changeset` to isolate runtime
imports. `/storage/signing` exports SigV4 helpers. `/cli` contains command parsing
and process management; `/cli/scaffold` and `/cli/docs` are explicit tooling APIs.
See README.md for release status and installation commands.

`/auth/social` optionally accepts `intentStore: createMemoryIntentStore({ maxEntries? })`.
The error callback receives `(conn, error, { returnTo? })`; this provider-bound,
single-use hint restores only an allowed error destination and cannot authenticate
or link an account. Missing-cookie callbacks still fail authentication.

`/db/postgres#connect({ url, pool?, driver?: "postgres" })` and
`/db/sqlite#connect({ path, driver?: "sqlite" })` load only the chosen driver.
`ChangesetValidator` is a structural safeParse contract, with no required Zod import.

`/storage#upload(store, { key, body, contentType?, acl? })` accepts `"private"` or
`"public-read"` per object. Omitting `acl` sends no ACL header. The explicit ACL
header is signed; neither bucket policy nor store defaults are changed.

## @wess/atlas/billing
```
createBilling({ secretKey, webhookSecret, prices, store, accountMetadataKey?, apiVersion? }) → Billing
  .checkout({ accountId, plan, successUrl, cancelUrl }) → Promise<{ url }>
  .portal(accountId, returnUrl) → Promise<{ url }>
  .subscription(accountId) → Promise<Subscription | null>  persisted state
  .sync(accountId) → Promise<Subscription | null>          fetch current Stripe state and persist
  .webhook(rawBody, signature) → Promise<{ received: true, duplicate?, ignored? }>
verifySignature(rawBody, signature, secret, { now?, tolerance? }) → Promise<boolean>
isBillingError(error) → error is BillingError
BillingStore: get(id), findByCustomer(id), save(next, expectedRevision), hasEvent(id), recordEvent(id)
```
App-owned authorization and storage. `save` must atomically compare revisions, persist the
complete next account and any entitlement projection, and return false on conflict.
Persist checkout attempts and idempotent event receipts. Each account owns a dedicated
customer with at most one nonterminal subscription. See `packages/billing/AGENTS.md`.

```
createConnect({ secretKey, webhookSecret, store, fee, tax?, apiVersion? }) → Connect
  .onboard({ sellerId, country?, returnUrl, refreshUrl }) → Promise<{ url }>
  .seller(sellerId) → Promise<Seller>          persisted state
  .sync(sellerId) → Promise<Seller>            fetch the connected account and persist
  .checkout({ paymentId, sellerId, amount, currency, item, email?, successUrl, cancelUrl }) → Promise<{ url }>
  .payment(paymentId) → Promise<Payment>       persisted state
  .reconcile(paymentId) → Promise<Payment>     fetch current Stripe state and persist
  .refund(paymentId, amount?) → Promise<Payment>
  .webhook(rawBody, signature) → Promise<{ received: true, duplicate?, ignored? }>
ConnectStore: seller(id), sellerByAccount(id), saveSeller(next, expectedRevision), payment(id),
  paymentByIntent(id), createPayment(next), savePayment(next, expectedRevision), hasEvent(id), recordEvent(id)
```
Marketplace payments over Stripe Connect. Sellers own full-dashboard accounts and are the
merchant; one-time payments are direct charges on the seller's account with a platform fee.
The webhook takes the "connected accounts" endpoint and its own secret.

## @wess/atlas/config
```
env(name, opts?) → EnvRef<T>          opts: { parse: (s)=>T, default: string }
defineConfig(schema) → Readonly<T>    resolves all EnvRef values, freezes
```

## @wess/atlas/db
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
             .default(val) .defaultRaw(sql) .ref(table, col)
RowOf<typeof schema>                             extract row TS type
changeset(schema, { cast, required?, validate? }) → (data) => ChangesetResult
connect({ driver, path|url, pool? }) → Connection
  Connection: .execute<Row>(q) → Row[]
              .one<Row>(q) → Row | null
              .all<Row>(q) → Row[]
              .transaction(fn) .close()
              row type is inferred from the chain when from(schema) is used
```

## @wess/atlas/migrate
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

## @wess/atlas/server
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
serve({ port, routes, hostname?, websocket?, development?, maxRequestBodySize? }) // production mode, 1 MiB default
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

## @wess/atlas/edge
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

## @wess/atlas/server/ws
```
ws(config) → { websocket, rooms, upgrade }
channel(name, handlers) → Channel
createRooms() → { join, leave, leaveAll, broadcast, members }
WsConn<T>: wrapped ws with auto-JSON send
```

## @wess/atlas/server/sse
```
createSseChannel() → { broadcast, pipe, clients }
eventStream(conn, generator) → SSE response
SseClient: { id, send, close }
```

## @wess/atlas/auth
```
hash(password) → Promise<string>           Argon2id via Bun.password
verify(password, hashed) → Promise<bool>
token.sign(payload, secret, opts?) → Promise<string>   opts: { expiresIn: seconds }
token.verify(jwt, secret) → Promise<TokenPayload>
createMemoryStore({ ttl?, maxEntries? }) → SessionStore dev/testing session store; ttl seconds expires entries
signup({ db, table, fields, onSuccess }) → PipeFn
login({ db, table, identity, password, onSuccess }) → PipeFn
requireAuth({ secret }) → PipeFn           reads Bearer token, sets conn.assigns.auth
passwordReset({ db, table, secret, transport, expiresIn? }) → PipeFn
```

## @wess/atlas/auth/social
```
socialAuth({ secret, providers, cookie? }) → SocialAuth
  SocialAuth: { providers,
                authorize(name, { scopes?, returnTo?, extraParams? }?) → { url, cookie },
                complete(name, conn) → { provider, tokens, profile, returnTo? },
                start(name, opts?) → PipeFn,                     302s + sets state cookie
                callback(name, { onSuccess, onError? }) → PipeFn  validates state, exchanges code, clears cookie }
Provider factories — each returns a `SocialProvider`:
  google({ clientId, clientSecret, redirectUri, hostedDomain?, prompt? })
  github({ clientId, clientSecret, redirectUri, allowSignup? })
  apple({ clientId, teamId, keyId, privateKey, redirectUri, responseMode? })
    mints ES256 client_secret JWT per exchange; default response_mode=form_post
  microsoft({ clientId, clientSecret, redirectUri, tenant?, prompt? })   tenant defaults to "common"
  facebook({ clientId, clientSecret, redirectUri, apiVersion?, profileFields? })
  twitter({ clientId, clientSecret?, redirectUri, userFields? })          Basic auth for confidential clients
  tiktok({ clientKey, clientSecret, redirectUri, userFields? })           uses `client_key`, comma-joined scopes, id is open_id
SocialProfile: { provider, id, email?, emailVerified?, name?, picture?, username?, raw }
TokenSet: { accessToken, tokenType?, expiresIn?, refreshToken?, idToken?, scope?, raw }
State + PKCE verifier live in a signed, HttpOnly, SameSite=lax cookie
  (`_atlas_oauth_state`, 10 min TTL). Override via cookie: { name?, path?, secure?, sameSite? }.
```

## @wess/atlas/share
```
shareUrl(channel, content) → string           throws on unknown channel or missing url
share(content) → Record<ShareChannel, string> all eight URLs at once
listChannels() → { channel, label }[]         ordered list with display labels
channels                                       readonly ShareChannel[]
ShareChannel = "twitter" | "facebook" | "linkedin" | "reddit" | "whatsapp" | "telegram" | "sms" | "email"
ShareContent: { url, title?, text?, hashtags?, via?, phone?, to?, cc?, bcc? }
  url required; unknown fields ignored per channel.
Provider re-exports (each is a `ShareProvider { channel, label, build }`):
  twitter, facebook, linkedin, reddit, whatsapp, telegram, sms, email
shareEmail({ emailer, to, from?, replyTo?, sharerName?, product?, message?, content, brand?, accent? })
  → Promise<SendResult>                        dispatches a branded HTML email through @wess/atlas/email
renderShareEmailMessage(opts) → { subject, html, text }   pure preview/render
```

## @wess/atlas/email
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

## @wess/atlas/oauth
```
oauthRoutes(cfg, { basePath?, adminBasePath? }) → Route[]   all OAuth endpoints
oauthAuthorizeRoutes(cfg, base) | oauthTokenRoutes | oauthRevokeRoutes
oauthDeviceRoutes | oauthDiscoveryRoutes | oauthClientRoutes(cfg, adminBase)
findClient(db, id) | verifyClientCredentials(db, id, secret)
sweepExpired(cfg) | sweepExpiredAuthCodes | sweepExpiredRefreshTokens | sweepExpiredDeviceCodes(cfg)
helpers: parseScope, formatScope, includesScopes, isAllowedRedirect,
         verifyPkceS256, randomId, shortId, sha256, newUserCode, normalizeUserCode
constants: ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS,
           AUTH_CODE_TTL_SECONDS, DEVICE_CODE_TTL_SECONDS, DEVICE_POLL_INTERVAL_SECONDS
types: OAuthConfig, OAuthUser, ClientRow, AuthCodeRow, RefreshTokenRow,
       DeviceCodeRow, OAuthAuditEvent, RequestContext
```

## @wess/atlas/sso
```
mountSso(cfg: SsoConfig) → readonly Route[]            mount /login + /callback + /backchannel-logout
ensureSsoStateTable(db, table?)                        idempotent CREATE TABLE IF NOT EXISTS
sweepExpiredSsoState(db, table?)                       prune expired state rows (10m TTL)
clearDiscoveryCache()                                  for tests / hot-reload

SsoConfig: { db, issuerUrl, clientId, clientSecret,
             onAuthenticated(db, claims) → { localUserId, displayName? },
             issueSession(conn, user, claims) → Conn,
             redirectUri?, scopes?, basePath?, defaultPostLoginPath?, stateTable?,
             findLocalUserBySub?(db, sub), invalidateSessions?(db, { sub, localUserId }) }
IdTokenClaims: { sub, iss, aud, email?, email_verified?, name?, preferred_username?, picture?, ... }
DiscoveryDoc: { issuer, authorization_endpoint, token_endpoint, jwks_uri, userinfo_endpoint?, end_session_endpoint? }
```

## @wess/atlas/security
```
withSecurityHeaders(fetch, { dev?, csp?, disableCsp? }) → fetch     HSTS/CSP/COOP/CORP + req.peerIp shim
developmentCsp | productionCsp                                       string CSP presets
decideInline(mime, name, wantInline) → { contentType, disposition }  safe-MIME allowlist for inline
createDbRateLimit({ db }) | createMemoryRateLimit({ maxEntries? }) → RateLimit      .check(bucket, max, windowSec) .reset(bucket) .sweep(olderThanSec)
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

## @wess/atlas/storage
```
createStore({ endpoint, bucket, region, accessKey, secretKey }) → Store
upload(store, { key, body, contentType?, acl?, maxBytes?, signal? }) → Promise
download(store, key) → Promise<Response>
list(store, prefix?) → Promise<ListResult>
remove(store, key) → Promise
stat(store, key) → Promise<{ size, contentType, etag } | null>   signed HEAD, null on 404
presign(store, key, { expires?, method?, query? }) → string     query = extra signed params
```

## @wess/atlas/cache
```
createCache({ url }) → Cache               Redis-backed
createMemoryCache() → Cache                 in-memory for dev
cached(cache, prefix, fn, { ttl? }) → cached function
invalidate(cache, prefix, ...args) → Promise
```

## @wess/atlas/request
```
request(url, opts?) → Promise<Response>     opts: { json, headers, method, body, retry, timeout (ms) }
createClient({ baseUrl, headers?, retry?, interceptors?, timeout? }) → Client
  Client: .get .post .put .patch .del .request — all return Promise<Response>
withRetry(fn, { attempts?, delay?, backoff?, retryOn? })
github({ token }) | stripe({ key }) | openai({ key }) | resend({ key })
  preconfigured clients — import from @wess/atlas/request/providers
```

## @wess/atlas/cli
```
cli(name, commands)                  run CLI with command definitions
command(name, { flags?, run })       define a command
flag(short, { type, default? })      define a flag
parseArgs(argv, flags) → ParsedArgs
foreman(procs) | parseProcfile(str)  process manager
@wess/atlas/cli/scaffold: questions | applyDefaults | generateProject | initCommand
@wess/atlas/cli/docs: docsCommand

CLI surface:
  atlas init [-y] [-n name]            scaffold a new project
  atlas add <pkg>...                   install @wess/atlas/* packages
  atlas check                         reject local Atlas paths and legacy aliases
  atlas dev                             foreman → Procfile
  atlas mcp                             start MCP server
  atlas docs [<pkg>|<doc>|<root>]      print canonical documentation to stdout
```

## @wess/atlas/ui
```
@wess/atlas/ui/provider:  AtlasProvider, AppShell
@wess/atlas/ui/forms:     createForm, TextField, SelectField, SubmitButton
@wess/atlas/ui/table:     createTable, TextColumn, DateColumn, ActionColumn
@wess/atlas/ui/auth:      LoginPage, SignupPage, ResetPasswordPage
@wess/atlas/ui/storage:   FileUpload, ImagePreview
@wess/atlas/ui/nav:       Sidebar, NavLink, Breadcrumb
@wess/atlas/ui/cache:     CacheInspector, CacheStatus
@wess/atlas/ui/ai:        ChatWindow, MessageBubble, PromptInput, AiSearch, GenerateButton
```

## @wess/atlas/admin
```
admin({ db, models, basePath?, auth? }) → { mount, routes }
model({ schema, listFields?, searchFields?, filterFields?, relations?, actions?, bulkActions?, readOnly? }) → ModelConfig
Components: AdminApp, AdminSidebar, Dashboard, ModelList, Detail, Create, FilterBuilder, QueryBuilder, BulkBar
```

## @wess/atlas/mcp
```
createContext(opts?) → AtlasMcpContext      opts: { db?, cache?, routes?, config?, storage?, migrationsDir?, logBuffer? }
collectTools(ctx) → Tool[]                  tools auto-register from what's in ctx
createMcpServer(tools, ctx) → McpServer
defineTool({ name, description, inputSchema, handler }) → Tool
McpServer: .start() .stop()

Always-on tools (independent of context):
  docs.list                              list package, guide, and root documentation sources
  docs.read({ package?, doc?, root? })   read one canonical source; docs/agents.md is the grounding guide
```

## @wess/atlas/ai
```
createProvider({ provider, key?, baseUrl? }) → AiProvider   provider: "openai"|"anthropic"|"ollama"
createConversation(system?) → Conversation
addMessage(conv, msg) → Conversation
send(provider, conv, content, opts?) → { conversation, response }
userMessage|assistantMessage|systemMessage(content) → Message
toolMessage(toolCallId, content) → Message
chatStream: provider.chatStream(opts) → AsyncIterable
collectStream(stream) → ChatResponse
streamToSse(stream) → ReadableStream
parseSSE(text) → events
embed(provider, input) → number[][]        input: string | string[]
cosineSimilarity(a, b) → number
createVectorStore() → { add, search, size }
generateJson<T>(provider, prompt, opts?) → T
tool(name, desc, parameters) → ToolDef
index(rag, id, text, metadata?) → Promise  rag: { ai, store, topK? }
query(rag, question) → { answer, sources }
runAgent({ ai, system?, tools, maxIterations? }, prompt) → { response, messages, iterations }
withAi(provider) → PipeFn                  adds ai to conn.assigns
```

## Dependency baseline

Atlas 0.4 uses Zod 4, React 19.3, Mantine 9, and TanStack Table 9.
Table column helpers return TanStack v9 column definitions. Pass object or array
rows to `createTable`; its search, sorting, and pagination options are unchanged.

Memory sessions and rate-limit buckets default to 10,000 entries and refuse new entries at capacity. SSE buffers at most 256 KiB per client; slow consumers reconnect. Cache misses for the same key share one load. SQLite transactions serialize access to their connection; use `tx` inside callbacks. Admin query fields must belong to registered schemas; query limits default to 100 and cap at 1000. SSO state is browser-bound and single-use, return destinations are local, and logout checks issuer/audience plus replay protection.

Scaffolds and `atlas add` select coordinated, versioned `@wess/atlas` libraries from
versioned GitHub release assets. Emitted imports use public `@wess/atlas/*` paths. Template installs
generate fresh authentication secrets and keep the CLI in development dependencies.
Applications must install without a local Atlas checkout. See README.md for release status.

Storage uploads hash Blobs incrementally and spool one-shot streams to private temporary
files instead of buffering whole uploads. `maxBytes` defaults to 5 GiB; set a smaller
application limit. `signal` cancels preparation and transport. Temporary files are removed
after success, failure, or cancellation. Keys preserve reserved characters and Unicode;
dot path segments are rejected. `/storage/signing#signRequest` accepts a precomputed
`payloadHash` when signing a body hashed by the caller.

Admin auth requires `{ secret, authorize: claims => boolean | Promise<boolean> }`; authenticated users without permission receive 403. Anonymous admin configuration requires explicit `allowUnauthenticated: true` for local development and is rejected in production. Browser admin components are exported from `@wess/atlas/admin/ui`, keeping UI dependencies out of server startup. CMS administrator registration requires the generated `ADMIN_SETUP_SECRET` via `X-Setup-Token`.
