# {{name}}

Full-stack Atlas app with REST API and React frontend using Atlas UI blocks.

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
- `src/frontend/` — React app with Atlas UI components
- `index.html` — Bun HTML import entry point
