# {{name}}

Full-stack Atlas app with REST API and a React + Mantine frontend wrapped in Atlas UI's provider.

## Setup

```sh
cp .env.example .env
bun install
atlas migrate up
bun run server.ts
```

## Structure

- `server.ts` — serves API routes and the frontend HTML
- `src/routes/` — API endpoints
- `src/frontend/` — React app (Atlas UI provider + Mantine components)
- `index.html` — Bun HTML import entry point
- `migrations/` — SQL migrations (`atlas migrate up`)
