# {{name}}

A headless content management system built with Atlas. Define content types, create and publish entries, manage media, and deliver content to any frontend via a read-only API.

## Two-API Architecture

This CMS exposes two separate APIs:

### Admin API (`/admin/api/*`)

Authenticated via JWT (login at `/admin/api/auth/login`). Used by content editors to manage everything: content types, entries, media, API keys, and webhooks.

### Delivery API (`/api/*`)

Authenticated via `X-API-Key` header. Read-only, designed for frontends to consume published content. Supports pagination, sorting, sparse fields, and author includes.

## Getting Started

```sh
bun install
bun run migrate:up
bun run dev
```

Open `http://localhost:3000` for the admin panel. Register an account to get started.

## Environment Variables

See `.env.example` for all options:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | `sqlite://{{name}}.db` | Database connection |
| `AUTH_SECRET` | `change-me-in-production` | JWT signing secret |
| `STORAGE_PATH` | `./uploads` | Local file storage path |
| `S3_BUCKET` | | S3 bucket for media (optional) |
| `WEBHOOK_TIMEOUT` | `5000` | Webhook delivery timeout (ms) |

## API Endpoints

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/admin/api/auth/login` | Login, returns JWT |
| `POST` | `/admin/api/auth/register` | Register admin user |

### Content Types (Admin, JWT)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/api/types` | List all content types |
| `GET` | `/admin/api/types/:id` | Get a content type |
| `POST` | `/admin/api/types` | Create a content type |
| `PUT` | `/admin/api/types/:id` | Update a content type |
| `DELETE` | `/admin/api/types/:id` | Delete a content type |

Content type fields are defined as JSON:

```json
[
  { "name": "title", "type": "text", "required": true },
  { "name": "body", "type": "richtext" },
  { "name": "image", "type": "media" },
  { "name": "tags", "type": "list" }
]
```

### Entries (Admin, JWT)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/api/entries` | List entries (?type, ?status, ?limit, ?offset) |
| `GET` | `/admin/api/entries/:id` | Get an entry |
| `POST` | `/admin/api/entries` | Create an entry (draft) |
| `PUT` | `/admin/api/entries/:id` | Update an entry |
| `DELETE` | `/admin/api/entries/:id` | Delete an entry |
| `POST` | `/admin/api/entries/:id/publish` | Publish an entry |
| `POST` | `/admin/api/entries/:id/unpublish` | Unpublish an entry |

### Revisions (Admin, JWT)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/api/entries/:id/revisions` | List revisions for an entry |
| `POST` | `/admin/api/entries/:id/revisions/:revId/restore` | Restore a previous revision |

### Media (Admin, JWT)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/api/media` | List media (?contentType, ?limit, ?offset) |
| `POST` | `/admin/api/media` | Upload media (multipart form) |
| `DELETE` | `/admin/api/media/:id` | Delete media |

### API Keys (Admin only, JWT)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/api/keys` | List API keys |
| `POST` | `/admin/api/keys` | Create an API key |
| `DELETE` | `/admin/api/keys/:id` | Revoke an API key |

### Webhooks (Admin only, JWT)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/api/webhooks` | List webhooks |
| `POST` | `/admin/api/webhooks` | Create a webhook |
| `PUT` | `/admin/api/webhooks/:id` | Update a webhook |
| `DELETE` | `/admin/api/webhooks/:id` | Delete a webhook |

Supported webhook events: `entry.published`, `entry.unpublished`

Payloads are signed with HMAC-SHA256. Verify using the `X-Webhook-Signature` header and the webhook secret returned on creation.

### Delivery API (X-API-Key)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/content/:type` | List published entries by content type |
| `GET` | `/api/content/:type/:slug` | Get a single published entry by slug |
| `GET` | `/api/media/:id` | Get media metadata |

#### Query Parameters

| Param | Default | Description |
|---|---|---|
| `limit` | `10` | Number of entries per page |
| `offset` | `0` | Pagination offset |
| `sort` | `published_at` | Sort field (published_at, created_at, updated_at, slug) |
| `order` | `desc` | Sort order (asc, desc) |
| `fields` | all | Sparse fields, comma-separated (e.g. `?fields=title,body`) |
| `include` | none | Include relations (e.g. `?include=author`) |
| `status` | `published` | Filter by status |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |

## Publishing Workflow

1. Create an entry (status: `draft`)
2. Edit and save (each save creates a revision)
3. Publish (`POST /admin/api/entries/:id/publish`) sets status to `published` and fires webhooks
4. Unpublish reverts to `draft` and fires webhooks
5. Restore a revision to revert content to a previous version

## Roles

- **admin** -- full access, can manage API keys and webhooks
- **editor** -- can create, edit, publish entries and upload media
- **viewer** -- read-only access to admin API
