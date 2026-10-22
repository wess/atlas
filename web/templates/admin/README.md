# {{name}}

API with auto-generated admin panel for managing users and posts.

## Setup

```sh
test -f .env || cp .env.example .env
bun install
atlas migrate up
bun run server.ts
```

## Routes

- `GET /api/health` — health check
- `GET /api/users` — list users (auth required)
- `GET /api/posts` — list published posts
- `POST /api/posts` — create post (auth required)
- `/admin/*` — admin panel UI

`atlas init` creates `.env` with fresh authentication secrets. Preserve that file. When copying this template manually, fill each authentication/setup secret with at least 32 random characters before starting.
