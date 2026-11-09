# {{name}}

Full-stack Atlas app with REST API and a React frontend built on Atlas UI.

## Setup

```sh
test -f .env || cp .env.example .env
bun install
atlas migrate up
bun run server.ts
```

## Structure

- `server.ts` — serves API routes and the frontend HTML
- `src/routes/` — API endpoints
- `src/frontend/` — React app using `@wess/atlas/ui/components`, with `@wess/atlas/ui/styles.css` imported once. Add screens as real paths with `useLocation` and `navigate` from `@wess/atlas/ui/headless`; the server already sends the app for every path
- `index.html` — Bun HTML import entry point
- `migrations/` — SQL migrations (`atlas migrate up`)

`atlas init` creates `.env` with fresh authentication secrets. Preserve that file. When copying this template manually, fill each authentication/setup secret with at least 32 random characters before starting.
