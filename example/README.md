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

## API

### Auth
- `POST /signup` — `{ handle, email, password }`
- `POST /login` — `{ email, password }` → `{ token }`

### Posts
- `POST /posts` — `{ content }` (280 char max)
- `GET /posts/:id`
- `DELETE /posts/:id`

### Timeline
- `GET /timeline` — posts from people you follow
- `GET /users/:handle/posts` — a user's posts

### Social
- `POST /follow/:userId` — follow a user
- `DELETE /follow/:userId` — unfollow
- `POST /posts/:id/like` — like a post
- `DELETE /posts/:id/like` — unlike
- `GET /users/:handle` — user profile

All routes except signup/login require `Authorization: Bearer <token>`.
