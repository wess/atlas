# Atlas Quick Start

This guide walks you through building a complete app with user authentication, file uploads, and an admin panel.

## Prerequisites

- **Bun 1.0+** — Install from https://bun.sh
- **Postgres** (optional) — For production; SQLite works for development
- **Redis** (optional) — For caching; memory cache works for dev

This guide uses SQLite for simplicity.

## Step 1: Create a Project

```bash
mkdir myapp
cd myapp
bun init -y
```

Add Atlas packages:

```bash
bun add @atlas/config @atlas/db @atlas/migrate @atlas/server @atlas/auth \
         @atlas/storage @atlas/cli @atlas/admin
```

Create `.env`:

```
DATABASE_URL="sqlite:./app.db"
PORT=3000
SECRET="dev-secret-key-change-in-production"
S3_ENDPOINT="http://localhost:9000"
S3_BUCKET="files"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
```

## Step 2: Define Schemas

Create `src/schema.ts`:

```ts
import { defineSchema, column } from "@atlas/db"

export const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  name: column.text(),
  passwordHash: column.text(),
  createdAt: column.timestamp().default("now()"),
})

export const uploads = defineSchema("uploads", {
  id: column.serial().primaryKey(),
  userId: column.integer().ref(users, "id"),
  filename: column.text(),
  key: column.text(),
  size: column.integer(),
  contentType: column.text(),
  createdAt: column.timestamp().default("now()"),
})
```

## Step 3: Set Up Config

Create `src/config.ts`:

```ts
import { defineConfig, env } from "@atlas/config"

export const config = defineConfig({
  database: env("DATABASE_URL"),
  port: env("PORT", { parse: Number, default: "3000" }),
  secret: env("SECRET"),
  s3: {
    endpoint: env("S3_ENDPOINT"),
    bucket: env("S3_BUCKET"),
    accessKey: env("S3_ACCESS_KEY"),
    secretKey: env("S3_SECRET_KEY"),
  },
})
```

## Step 4: Create Migrations

You can hand-write migrations under `migrations/<timestamp>_<name>/{up,down}.sql`,
or — preferred — generate them from the `defineSchema()` you already wrote:

```ts
// scripts/diff.ts
import { connect } from "@atlas/db"
import { migrate } from "@atlas/migrate"
import { users, uploads } from "../src/schema"

const db = connect({ driver: "sqlite", path: "./app.db" })
const result = await migrate.diff(db, [users, uploads], { name: "init" })
if (result.noop) console.log("schema in sync")
else console.log(`wrote ${result.path}`)
await db.close()
```

```bash
bun scripts/diff.ts   # writes migrations/<ts>_init/up.sql + down.sql
```

`migrate.diff` introspects the live database and emits SQL for any new tables,
added/removed columns, and (as `-- ALTER` comments) type/nullability mismatches.
Re-running it after a schema edit produces an incremental migration.

For reference, here's what an init migration ends up looking like:

```sql
-- migrations/<ts>_init/up.sql (generated)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  createdAt TIMESTAMP NOT NULL
);

CREATE TABLE uploads (
  id INTEGER PRIMARY KEY,
  userId INTEGER NOT NULL,
  filename TEXT NOT NULL,
  key TEXT NOT NULL,
  size INTEGER NOT NULL,
  contentType TEXT NOT NULL,
  createdAt TIMESTAMP NOT NULL
);
```

## Step 5: Build the API

Create `src/server.ts`:

```ts
import { config } from "./config"
import { users, uploads } from "./schema"
import { connect, from, type RowOf } from "@atlas/db"
import { migrate } from "@atlas/migrate"
import {
  serve,
  pipeline,
  parseMultipart,
  json,
  badRequest,
  getR,
  postR,
  post,
  parseJson,
} from "@atlas/server"
import { token, signup, login, requireAuth } from "@atlas/auth"
import { createStore, upload as uploadFile, presign } from "@atlas/storage"
import { admin, model } from "@atlas/admin"

// Connect to database
const db = connect({ driver: "sqlite", path: "./app.db" })

// Run migrations
await migrate.up(db, "./migrations")

// Storage setup
const store = createStore({
  endpoint: config.s3.endpoint,
  bucket: config.s3.bucket,
  accessKey: config.s3.accessKey,
  secretKey: config.s3.secretKey,
})

// Pipes that populate conn.assigns.auth (claims from the JWT).
const authGuard = requireAuth({ secret: config.secret })
type AuthClaims = { auth: { id: number } }

// Typed routes — c.assigns.auth.id is `number`, no casts.
const meRoute = getR<Record<string, never>, never, Record<string, string>, AuthClaims>(
  "/api/me",
  { before: [authGuard], assigns: {} as AuthClaims },
  (c) => json(c, 200, { id: c.assigns.auth.id }),
)

const filesRoute = getR<Record<string, never>, never, Record<string, string>, AuthClaims>(
  "/api/files",
  { before: [authGuard], assigns: {} as AuthClaims },
  async (c) => {
    type UploadRow = RowOf<typeof uploads>
    const rows: Pick<UploadRow, "id" | "filename" | "key" | "size" | "createdAt">[] = await db.all(
      from(uploads)
        .where((q) => q("userId").equals(c.assigns.auth.id))
        .select("id", "filename", "key", "size", "createdAt"),
    )
    return json(c, 200, rows)
  },
)

// Multipart upload still uses parseMultipart in `before` — typed body validators
// expect JSON. `throw badRequest(...)` becomes a 400 with { error, code? }.
const uploadRoute = post(
  "/api/upload",
  pipeline(authGuard, parseMultipart)(async (c) => {
    const userId = (c.assigns.auth as { id: number }).id
    const body = c.body as FormData
    const file = body.get("file") as File | null
    if (!file) throw badRequest("missing file", { code: "MISSING_FILE" })

    const key = `uploads/${userId}/${file.name}`
    await uploadFile(store, { key, body: file, contentType: file.type })

    const [created] = await db.execute(
      from(uploads)
        .insert({
          userId,
          filename: file.name,
          key,
          size: file.size,
          contentType: file.type,
        })
        .returning("id"),
    )

    return json(c, 201, {
      id: created?.id,
      filename: file.name,
      url: presign(store, key, { expires: 3600 }),
    })
  }),
)

// Admin panel
const adminPanel = admin({
  db,
  basePath: "/admin",
  auth: { secret: config.secret },
  models: [
    model({
      schema: users,
      searchFields: ["email", "name"],
      filterFields: ["createdAt"],
    }),
    model({
      schema: uploads,
      searchFields: ["filename"],
      readOnly: true,
    }),
  ],
})

// Routes
serve({
  port: config.port,
  hostname: "0.0.0.0",
  routes: [
    // Auth
    post("/auth/signup", pipeline(parseJson)(
      signup({
        db,
        table: users,
        fields: ["email", "name", "password"],
        onSuccess: (c, user) =>
          json(c, 201, {
            id: user.id,
            email: user.email,
            name: user.name,
          }),
      })
    )),

    post("/auth/login", pipeline(parseJson)(
      login({
        db,
        table: users,
        identity: "email",
        password: "password",
        onSuccess: (c, user) =>
          json(c, 200, {
            token: await token.sign({ id: user.id }, config.secret),
            user: { id: user.id, email: user.email, name: user.name },
          }),
      })
    )),

    // Protected API
    meRoute,
    uploadRoute,
    filesRoute,

    // Admin
    ...adminPanel.mount([]),
  ],

  development: true,
})

console.log(`Server running on http://localhost:${config.port}`)
console.log(`Admin panel at http://localhost:${config.port}/admin`)
```

## Step 6: Run the Server

```bash
bun src/server.ts
```

You should see:
```
Server running on http://localhost:3000
Admin panel at http://localhost:3000/admin
```

## Step 7: Test the API

### Sign up a user:

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "content-type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "password": "secure123"
  }'
```

Response:
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe"
}
```

### Log in:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "content-type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure123"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "id": 1, "email": "user@example.com", "name": "John Doe" }
}
```

### Get authenticated user info:

```bash
curl -X GET http://localhost:3000/api/me \
  -H "authorization: Bearer <token>"
```

### Upload a file:

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "authorization: Bearer <token>" \
  -F "file=@/path/to/file.pdf"
```

### List files:

```bash
curl -X GET http://localhost:3000/api/files \
  -H "authorization: Bearer <token>"
```

## Step 8: Access the Admin Panel

Open http://localhost:3000/admin in your browser.

You'll see:
- **Users** list with email and name search
- **Uploads** list (read-only) showing all file uploads
- Full CRUD for users (create, edit, delete)
- Filters, bulk actions, custom query builder

## Next Steps

### Add Frontend

Create a React frontend using `@atlas/ui` blocks:

```tsx
// frontend.tsx
import React from "react"
import { createRoot } from "react-dom/client"
import { AtlasProvider, AppShell } from "@atlas/ui/provider"
import { LoginPage } from "@atlas/ui/auth"
import { FileUpload } from "@atlas/ui/storage"

export default function App() {
  const [token, setToken] = React.useState<string | null>(null)

  if (!token) {
    return (
      <LoginPage
        onSubmit={async (email, password) => {
          const res = await fetch("/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, password }),
          })
          const data = await res.json()
          if (data.token) {
            setToken(data.token)
            return {}
          }
          return { error: "Login failed" }
        }}
      />
    )
  }

  return (
    <AtlasProvider>
      <AppShell>
        <FileUpload
          onUpload={async (file) => {
            const form = new FormData()
            form.append("file", file)
            await fetch("/api/upload", {
              method: "POST",
              headers: { authorization: `Bearer ${token}` },
              body: form,
            })
          }}
        />
      </AppShell>
    </AtlasProvider>
  )
}

const root = createRoot(document.body)
root.render(<App />)
```

### Add Caching

```ts
import { createCache, cached } from "@atlas/cache"

const cache = createCache({ url: process.env.REDIS_URL || "redis://localhost" })

const getUser = cached(cache, "user", async (id: number) => {
  return await db.one(from(users).where(q => q("id").equals(id)))
}, { ttl: 600 })

const user = await getUser(1) // cached for 10 minutes
```

### Use Postgres in Production

```ts
const db = connect({
  driver: "postgres",
  url: config.database,
  pool: 10,
})
```

Update migrations path as needed. Everything else stays the same.

### Add AI

```ts
import { createProvider, chat, chatStream } from "@atlas/ai"

const openai = createProvider("openai", { apiKey: process.env.OPENAI_API_KEY })

const reply = await chat(openai, {
  model: "gpt-4o",
  messages: [{ role: "user", content: "Summarize this document" }],
})

// Streaming
for await (const chunk of chatStream(openai, { model: "gpt-4o", messages })) {
  process.stdout.write(chunk.content)
}
```

Add the AI UI block to your frontend:

```tsx
import { ChatPanel } from "@atlas/ui/ai"

<ChatPanel endpoint="/api/chat" />
```

### Add External API Calls

```ts
import { createClient, github } from "@atlas/request"

const gh = github({ token: process.env.GITHUB_TOKEN })
const repos = await gh.get("/user/repos").json()
```

### Add MCP Debugging

```ts
import { createMcpServer } from "@atlas/mcp"

const mcp = createMcpServer({ db, routes: myRoutes, config })
mcp.start()
```

Or launch via the CLI: `atlas mcp`

## Templates

Scaffold a complete project with `atlas init`:

```bash
atlas init myapp --template <template>
```

| Template | Description |
|----------|-------------|
| `minimal` | Just server + config |
| `api` | REST API with db, auth, migrations |
| `edge` | App + TLS-terminating edge (replaces Caddy/nginx) |
| `fullstack` | API + React frontend |
| `admin` | API + admin panel |
| `worker` | Background job processor |
| `realtime` | WebSocket + SSE |
| `socialnetwork` | Users, posts, follows, likes, feeds, media, real-time |
| `cms` | Headless CMS with content types, publishing, webhooks |
| `ai` | Chatbot, RAG, agents, embeddings, streaming |

Examples:

```bash
atlas init myapi --template api
atlas init mysite --template fullstack
atlas init mybot --template ai
atlas init mysocial --template socialnetwork
```

### Deploy with TLS (no Caddy / nginx)

`@atlas/edge` terminates TLS, automates Let's Encrypt, and reverse-proxies
to your app. The `edge` template ships a complete pattern — a one-line
edge.ts, a Dockerfile, and a compose.yaml that drops the typical caddy
sidecar entirely.

Add it to an existing app:

```ts
// edge.ts
import { LETSENCRYPT_PROD, LETSENCRYPT_STAGING, defineEdge, proxy } from "@atlas/edge"

const isProd = Boolean(process.env.ADMIN_EMAIL)

defineEdge({
  acme: isProd
    ? {
        email: process.env.ADMIN_EMAIL!,
        storage: process.env.CERT_DIR ?? "/var/atlas/edge",
        directoryUrl: process.env.ACME_STAGING ? LETSENCRYPT_STAGING : LETSENCRYPT_PROD,
      }
    : undefined,
  sites: [{
    host: process.env.DOMAIN ?? "localhost",
    compress: ["gzip", "zstd"],
    routes: [{ handler: proxy(`http://localhost:${process.env.APP_PORT ?? 3000}`) }],
  }],
}).listen()
```

In dev (`DOMAIN` unset), the edge auto-detects localhost and runs plain
HTTP on `:8080` — no certs, no sudo. In production, it listens on `:80`
+ `:443`, issues real certs, and renews them automatically 30 days
before expiry.

**First prod boot — use staging once.** Let's Encrypt's prod endpoint has
a 5-failures-per-hostname-per-hour rate limit. Run with `ACME_STAGING=1`
the first time to verify the wiring (browser will show "untrusted
issuer" — that's expected for staging certs), then clear the cert volume
and bring the service back up without `ACME_STAGING`.

## Troubleshooting

**SQLite database locked** — Close other connections or use WAL mode:
```sql
PRAGMA journal_mode=WAL;
```

**Admin panel 404** — Make sure migrations ran successfully:
```ts
const statuses = await migrate.status(db, "./migrations")
console.log(statuses)
```

**S3 upload fails** — Check endpoint and credentials in `.env`. MinIO local: `http://localhost:9000`

**Auth token invalid** — Make sure SECRET is the same in config and token.verify
