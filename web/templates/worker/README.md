# {{name}}

Background job processor with Redis queue and HTTP API for job submission.

## Setup

```sh
cp .env.example .env
bun install
bun run server.ts   # start API
bun run worker.ts   # start worker (separate terminal)
```

Or use the Procfile:

```sh
atlas dev
```

## API

- `GET /health` — health check
- `POST /api/jobs` — enqueue a job `{ type: "example", payload: { message: "hi" } }`
- `GET /api/jobs/:id/status` — check job status
