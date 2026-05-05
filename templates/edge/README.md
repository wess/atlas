# {{name}}

Atlas app with built-in TLS-terminating edge — no Caddy, no nginx.

## Local dev

```sh
cp .env.example .env
bun install
bun run dev
```

`atlas dev` starts both processes from the `Procfile`:

- `app` on `:3000` — your application
- `edge` on `:8080` — the proxy in front of it

Visit <http://localhost:8080>. The edge auto-detects localhost and skips
TLS entirely, so no certs or sudo are needed.

## Production

```sh
DOMAIN=app.example.com ADMIN_EMAIL=you@example.com docker compose up -d
```

The edge container exposes `:80` + `:443`, persists certs to a docker
volume, and proxies to the app container at `app:3000`.

### First boot — use staging once

Let's Encrypt's prod endpoint has a **5-failures-per-hostname-per-hour**
rate limit. Run the first boot against staging to confirm everything
wires up:

```sh
ACME_STAGING=1 docker compose up -d
# browser will warn "untrusted issuer" — that's expected for staging
```

Once the staging cert is issued and the edge container is healthy, stop,
clear the cert volume, drop `ACME_STAGING`, and bring it back up:

```sh
docker compose down
docker volume rm $(basename $PWD)_certs
docker compose up -d
```

## Files

- `app.ts` — your application (just a stub here; replace with real routes)
- `edge.ts` — TLS terminator + reverse proxy. Hardly ever needs editing.
- `src/config.ts` — env var binding. Single switch (`ADMIN_EMAIL`) selects
  dev vs prod mode.
- `Procfile` — Foreman entries for local dev (used by `atlas dev`)
- `compose.yaml` — production deploy
- `.env.example` — list of vars that matter, with comments

## Adding routes

Edit `app.ts`. The edge does not need to know about your routes — it
forwards everything. If you need path-based routing across multiple
upstreams (say a git smart-HTTP service alongside the main app), add
matchers in `edge.ts`:

```ts
sites: [{
  host: config.domain,
  routes: [
    { match: { path: /\.git(\/.*)?$/ }, handler: proxy("http://gitd:3001") },
    { handler: proxy(upstreamUrl) },
  ],
}]
```
