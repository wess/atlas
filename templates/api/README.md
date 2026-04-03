# {{name}}

REST API with database, authentication, and migrations.

## Setup

```sh
cp .env.example .env
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
