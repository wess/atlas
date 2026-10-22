# {{name}}

REST API with database, authentication, and migrations.

## Setup

```sh
test -f .env || cp .env.example .env
bun install
atlas migrate up
bun run server.ts
```

## Routes

- `GET /health` — health check
- `GET /api/users` — list users (auth required)
- `GET /api/users/:id` — get user (auth required)
- `POST /api/users` — create user
- `PUT /api/users/:id` — update user (auth required)
- `DELETE /api/users/:id` — delete user (auth required)

`atlas init` creates `.env` with fresh authentication secrets. Preserve that file. When copying this template manually, fill each authentication/setup secret with at least 32 random characters before starting.
