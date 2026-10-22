# @wess/atlas/admin

Django-style admin panel that auto-generates CRUD API routes from @wess/atlas/db schemas.

## Exports

### Factory
- `admin(config: AdminConfig)` — creates admin routes from config, returns `{ routes: Route[], mount: (existing: Route[]) => Route[] }`
- `model(config: ModelConfig)` — creates a model configuration

### Types
- `AdminConfig` — top-level config: `{ db, models, basePath?, auth? }`
- `ModelConfig` — per-model config: `{ schema, listFields?, searchFields?, filterFields?, relations?, actions?, bulkActions?, readOnly? }`
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
| `ui/entry.tsx` | — | Browser entry point, mounts AdminApp |
| `ui/index.html` | — | HTML template for Bun HTML imports |
| `ui/styles.css` | — | Base styles |

The admin SPA is served at `GET {basePath}` and `GET {basePath}/*`. Uses React, Mantine, TanStack Table, and lucide-react.

## Dependencies

- `@wess/atlas/db` — schema, query builder, connection
- `@wess/atlas/server` — pipe, pipeline, router, json, parseJson
- `@wess/atlas/auth` — requireAuth (optional, when auth config provided)
- `@mantine/core`, `@mantine/hooks`, `@mantine/form` — UI components and hooks
- `@tanstack/react-table` — table with sorting, selection, pagination
- `react`, `react-dom` — rendering
- `lucide-react` — icons

Query payloads accept registered schema fields only, including sort/filter/group fields. Limits default to 100 and must be integers from 1 to 1000. List pages accept positive integer page/limit values, with at most 100 rows. When auth is configured, `auth.authorize(claims)` is required and must explicitly grant administrator access. Missing auth is rejected by default. Tests and local development can opt in with `allowUnauthenticated: true`; production always requires auth. Import browser components from `@wess/atlas/admin/ui`; the server entry point does not load React or Mantine.
