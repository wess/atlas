# @wess/atlas/admin

Django-style admin panel that auto-generates CRUD API routes from @wess/atlas/db schemas.

## Exports

### Factory
- `admin(config: AdminConfig)` — creates admin routes from config, returns `{ routes: Route[], mount: (existing: Route[]) => Route[] }`
- `model(config: ModelConfig)` — creates a model configuration

### Types
- `AdminConfig` — top-level config: `{ db, models, basePath?, auth? }`
- `ModelConfig` — per-model config: `{ schema, listFields?, searchFields?, filterFields?, relations?, actions?, bulkActions?, readOnly?, editableFields? }`
- `CustomAction<T>` — custom action: `{ name, label, handler }`
- `BulkAction` — `"delete" | "export"`
- `RelationConfig` — relation: `{ schema, foreignKey, label? }`
- `QueryPayload` — query builder payload: `{ table, select?, filters?, sort?, limit?, offset?, groupBy? }`
- `QueryFilter` — filter: `{ field, op, value? }` where op is `eq|neq|gt|gte|lt|lte|like|ilike|in|null|notnull`

## Generated Routes

For each model with table name `T` at `basePath` (default `/admin`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `{base}/api/schema` | All model metadata |
| GET | `{base}/api/{T}` | List (paginated, searchable, filterable, sortable) |
| GET | `{base}/api/{T}/:id` | Get one record |
| POST | `{base}/api/{T}` | Create record (unless readOnly) |
| PUT | `{base}/api/{T}/:id` | Update record (unless readOnly) |
| DELETE | `{base}/api/{T}/:id` | Delete record (unless readOnly) |
| POST | `{base}/api/{T}/bulk` | Bulk action (unless readOnly) |
| POST | `{base}/api/{T}/action` | Custom action |
| GET | `{base}/api/{T}/:id/relations/{R}` | Related records |
| POST | `{base}/api/query` | Execute query builder payload |
| POST | `{base}/api/query/preview` | Preview SQL without executing |

List endpoint query params: `?page=1&limit=20&sort=name&order=asc&search=foo&filter.status=active`

Create and update write only the model's schema columns: request fields outside
the schema are dropped, and primary keys (and `id`) are never written on
update. `editableFields` narrows writes to the listed columns; a primary key
listed there is writable on create only (for natural keys without a default).
A body that isn't an object, or with nothing editable left, gets 400. Keep
sensitive columns (roles, password hashes) out of the schema you pass, or out
of `editableFields`.

Bulk and custom actions require `ids` to be an array of strings or numbers;
anything else gets 400 before the handler runs.

## Usage

```ts
import { admin, model } from "@wess/atlas/admin"
import { defineSchema, column, connect } from "@wess/atlas/db"
import { serve, get, pipe, json } from "@wess/atlas/server"

const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  name: column.text(),
})

const posts = defineSchema("posts", {
  id: column.serial().primaryKey(),
  title: column.text(),
  userid: column.integer(),
})

const db = connect({ driver: "sqlite", path: "./app.db" })

const panel = admin({
  db,
  basePath: "/admin",
  auth: { secret: "my-secret", authorize: claims => claims.role === "admin" },
  models: [
    model({
      schema: users,
      searchFields: ["email", "name"],
      filterFields: ["name"],
      bulkActions: ["delete", "export"],
      relations: [{ schema: posts, foreignKey: "userid" }],
      actions: [{
        name: "deactivate",
        label: "Deactivate",
        handler: async (db, ids) => ({ message: `Deactivated ${ids.length}` }),
      }],
    }),
    model({ schema: posts, readOnly: true }),
  ],
})

serve({
  port: 3000,
  routes: panel.mount([
    get("/", pipe(c => json(c, 200, { status: "ok" }))),
  ]),
})
```

## UI Components

Frontend React SPA in `ui/`:

| File | Export | Description |
|------|--------|-------------|
| `ui/app.tsx` | `AdminApp` | Main SPA shell (sidebar + content, client-side routing) |
| `ui/dashboard.tsx` | `Dashboard` | Overview page with model record counts |
| `ui/list.tsx` | `ModelList` | Model list view (table, search, filters, sort, pagination, bulk actions) |
| `ui/detail.tsx` | `Detail` | Model detail/edit view (auto-generated form from schema) |
| `ui/create.tsx` | `Create` | Model create view (empty form) |
| `ui/query.tsx` | `QueryBuilder` | Visual query builder (select, filter, sort, group, preview SQL, execute) |
| `ui/components/sidebar.tsx` | `AdminSidebar` | Nav sidebar with model links and query builder link |
| `ui/components/filter.tsx` | `FilterBuilder` | Row-based filter builder |
| `ui/components/bulkbar.tsx` | `BulkBar` | Bulk action toolbar (appears when rows selected) |
| `ui/shell.ts` | `adminHtml` | Generates the HTML shell for serving the SPA |
| `ui/paths.ts` | `parseRoute`, `paths`, `hrefFor` | The screen URLs, in one place |
| `ui/assets.ts` | `loadAdminAssets`, `bundleAdmin` | Prebuilt browser bundle in a release, built on demand in a source checkout |
| `ui/entry.tsx` | — | Browser entry point, mounts AdminApp |
| `ui/index.html` | — | HTML template for Bun HTML imports |
| `ui/styles.css` | — | Base styles |

The admin SPA is served at `GET {basePath}` and `GET {basePath}/*`, with its bundle at `GET {basePath}/assets/entry.js` and `entry.css`. Screens are real paths through the History API: `{basePath}`, `/query`, `/models/:table`, `/models/:table/new`, `/models/:table/records/:id`. List page, search, sort, and filters live in the query string, and a record's relation tab in `?tab=`, so back, forward, and reload return to the same view. Query builder inputs stay in component state. Serving admin needs no React in the app's dependencies, because releases ship the built bundle. Uses React, `@wess/atlas/ui`, TanStack Table, and lucide-react.

## Dependencies

- `@wess/atlas/db` — schema, query builder, connection
- `@wess/atlas/server` — pipe, pipeline, router, json, parseJson
- `@wess/atlas/auth` — requireAuth (optional, when auth config provided)
- `@wess/atlas/ui` — UI components, hooks, and the compiled stylesheet
- `@tanstack/react-table` — table with sorting, selection, pagination
- `react`, `react-dom` — rendering
- `lucide-react` — icons

## Signing in

Give `auth` a `login` function and the admin has a sign-in screen at `{basePath}/login`:

```ts
admin({
  db,
  models,
  auth: {
    secret,
    authorize: (claims) => claims.role === "admin",
    login: async ({ email, password }) => {
      const user = await db.one(from(users).where((q) => q("email").equals(email)))
      return user && (await verify(password, user.passwordHash)) ? { userId: user.id, role: user.role } : null
    },
  },
})
```

`POST`, `GET`, and `DELETE {basePath}/session` sign in, report state, and sign out. A successful login sets a signed `HttpOnly`, `SameSite=Strict` cookie scoped to `basePath`, `Secure` in production, lasting `sessionSeconds` (default 8 hours). Claims must pass `authorize` before a cookie is issued, and again on every request.

Cookie-authenticated writes must carry an `Origin` matching the `Host` header, or one listed in `trustedOrigins` for a proxy that rewrites `Host`. `Authorization: Bearer` keeps working and takes precedence, without the origin check. Bearer and cookie auth both refuse OAuth access tokens (`typ: at+jwt`, or `client_id` + `scope` claims) and tokens with a `purpose` claim, even when signed with `auth.secret`. Sign-in attempts are limited to 10 per address and account per 15 minutes, 50 per address per 15 minutes, and 100 per account per hour, so one person can't lock an account out. Counts are in memory by default; pass `rateLimit: createDbRateLimit({ db })` when running more than one process. Behind a proxy, pass `trustedProxies: parseTrustedProxies(...)` so the real client address is used. IPv6 clients are counted per /64 (`addressKey`). Each session carries an id, and signing out revokes it, so a copied cookie stops working. Revocations live in memory by default; pass `revocations: createDbRevocations({ db })` to share them across processes and restarts (it creates `admin_revoked_sessions` on first use). Without `login`, the screen explains that sign-in isn't set up and Bearer tokens still work.

Query payloads accept registered schema fields only, including sort/filter/group fields. Limits default to 100 and must be integers from 1 to 1000. List pages accept positive integer page/limit values, with at most 100 rows. When auth is configured, `auth.authorize(claims)` is required and must explicitly grant administrator access. Missing auth is rejected by default. Tests and local development can opt in with `allowUnauthenticated: true`; production always requires auth. Import browser components from `@wess/atlas/admin/ui`; the server entry point does not load React.
