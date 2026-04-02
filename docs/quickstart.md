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

Create migrations folder and generate migration files:

```bash
mkdir migrations
```

Create `migrations/20260402_create_users/up.sql`:

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Create `migrations/20260402_create_users/down.sql`:

```sql
DROP TABLE users;
```

Create `migrations/20260403_create_uploads/up.sql`:

```sql
CREATE TABLE uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  key TEXT NOT NULL,
  size INTEGER NOT NULL,
  contentType TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Create `migrations/20260403_create_uploads/down.sql`:

```sql
DROP TABLE uploads;
```

## Step 5: Build the API

Create `src/server.ts`:

```ts
import { config } from "./config"
import { users, uploads } from "./schema"
import { connect } from "@atlas/db"
import { migrate } from "@atlas/migrate"
import {
  serve,
  router,
  pipe,
  pipeline,
  parseJson,
  parseMultipart,
  json,
  halt,
  assign,
} from "@atlas/server"
import {
  hash,
  verify,
  token,
  signup,
  login,
  requireAuth,
} from "@atlas/auth"
import { createStore, upload as uploadFile, presign } from "@atlas/storage"
import { admin, model } from "@atlas/admin"
import { from } from "@atlas/db"

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

// Auth handlers
const authGuard = requireAuth({ secret: config.secret })

const handleGetMe = pipe((c) => {
  const userId = (c.assigns.auth as any).id
  return json(c, 200, { id: userId })
})

const handleUpload = pipe(async (c) => {
  const userId = (c.assigns.auth as any).id
  const body = c.body as FormData

  const file = body.get("file") as File
  if (!file) return halt(c, 400, { error: "missing file" })

  const key = `uploads/${userId}/${file.name}`
  await uploadFile(store, { key, body: file, contentType: file.type })

  const presignedUrl = presign(store, key, { expires: 3600 })

  const result = await db.execute(
    from(uploads)
      .insert({
        userId,
        filename: file.name,
        key,
        size: file.size,
        contentType: file.type,
      })
      .toSql("sqlite")
  )

  return json(c, 201, {
    id: result[0],
    filename: file.name,
    url: presignedUrl,
  })
})

const handleListFiles = pipe(async (c) => {
  const userId = (c.assigns.auth as any).id
  const results = await db.all(
    from(uploads)
      .where((q) => q("userId").equals(userId))
      .select("id", "filename", "key", "size", "createdAt")
      .toSql("sqlite")
  )

  return json(c, 200, results)
})

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
  routes: router({
    // Auth
    "POST /auth/signup": pipeline(parseJson)(
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
    ),

    "POST /auth/login": pipeline(parseJson)(
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
    ),

    // Protected API
    "GET /api/me": pipeline(authGuard)(handleGetMe),

    "POST /api/upload": pipeline(authGuard, parseMultipart)(handleUpload),

    "GET /api/files": pipeline(authGuard)(handleListFiles),

    // Admin
    ...adminPanel.mount({}),
  }),

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
