# Chirp

A lightweight Twitter clone built with Atlas packages.

## Packages Used

- `@atlas/config` — environment variables
- `@atlas/db` — query builder + SQLite driver
- `@atlas/server` — HTTP server with pipes
- `@atlas/auth` — signup, login, JWT auth

## Run

```bash
bun install
bun run dev
```

One process serves everything on a single port (default `3000`): the API under
`/api/*`, and the React SPA (bundled by Bun straight from `index.html`) on every
other path. No separate web server or proxy.

## API

All API routes are mounted under `/api`.

### Auth
- `POST /api/signup` — `{ handle, email, password }`
- `POST /api/login` — `{ email, password }` → `{ token }`

### Posts
- `POST /api/posts` — `{ content }` (280 char max)
- `GET /api/posts/:id`
- `DELETE /api/posts/:id`

### Timeline
- `GET /api/timeline` — posts from people you follow
- `GET /api/users/:handle/posts` — a user's posts

### Social
- `POST /api/follow/:userId` — follow a user
- `DELETE /api/follow/:userId` — unfollow
- `POST /api/posts/:id/like` — like a post
- `DELETE /api/posts/:id/like` — unlike
- `GET /api/users/:handle` — user profile

All routes except signup/login require `Authorization: Bearer <token>`.
