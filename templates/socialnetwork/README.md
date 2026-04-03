# {{name}}

Social network with users, posts, follows, likes, feeds, file uploads, and real-time notifications.

## Setup

```sh
cp .env.example .env
bun install
atlas migrate up
bun run server.ts
```

## API Endpoints

### Auth
- `POST /api/auth/signup` — create account, returns token
- `POST /api/auth/login` — login, returns token

### Users
- `GET /api/users/:username` — public profile with counts
- `PUT /api/users/me` — update own profile (auth)
- `POST /api/users/:id/follow` — follow user (auth)
- `DELETE /api/users/:id/follow` — unfollow user (auth)
- `GET /api/users/:id/followers` — list followers
- `GET /api/users/:id/following` — list following

### Posts
- `POST /api/posts` — create post (auth)
- `GET /api/posts/:id` — get post with like count
- `DELETE /api/posts/:id` — delete own post (auth)
- `POST /api/posts/:id/like` — like post (auth)
- `DELETE /api/posts/:id/like` — unlike post (auth)
- `GET /api/users/:id/posts` — list user posts (paginated)

### Feed
- `GET /api/feed` — personalized feed from followed users (auth, paginated)
- `GET /api/feed/stream` — SSE feed updates (auth)

### Media
- `POST /api/media/upload` — upload image, returns URL (auth)

### Health
- `GET /health` — health check

## WebSocket

Connect to `ws://localhost:3000` with auth to receive real-time notifications for likes and follows.

## Packages

- `@atlas/server` — routing, middleware pipes
- `@atlas/db` — database queries
- `@atlas/auth` — password hashing, JWT tokens
- `@atlas/storage` — file uploads (local or S3)
- `@atlas/admin` — admin dashboard
- `@atlas/cache` — caching layer
- `@atlas/migrate` — database migrations
- `@atlas/config` — environment config
