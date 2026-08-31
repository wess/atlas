# @atlas/edge

TLS-terminating reverse proxy with built-in Let's Encrypt automation.
Replaces a Caddy/nginx layer in front of a Bun app.

## Exports

### Top-level (`index.ts`)
- `defineEdge(config)` — build a config object with a `.listen()` method
- `runEdge(config)` — start the edge directly, returns `RunningEdge`
- `proxy(upstream, opts?)` — handler that forwards to an upstream URL
- `files(options)` — handler that serves files from disk
- `forward(req, options, ctx)` — low-level proxy primitive
- `compressResponse(res, accept, allow)` — apply gzip/zstd to a Response
- `matchHost(host, pattern)` — host-pattern matcher (literal or `*.x.com`)
- `matchRoute(req, url, matcher?)` — route matcher (path + method)
- `isLocalHost(host)` — recognises localhost / 127.0.0.1 / ::1 / *.localhost

### ACME (`acme/index.ts`)
- `provisionCertificate(opts)` — orchestrates the full LE flow
- `generateKeyPair()` / `importKeyPair(jwk)` / `jwkThumbprint(jwk)`
- `LETSENCRYPT_PROD` / `LETSENCRYPT_STAGING` — directory URLs

### Certs (`certs/index.ts`)
- `fileStore(root)` / `memoryStore()` — `CertStore` implementations
- `issueCert(params)` — issue a fresh cert (HTTP-01 challenge)
- `loadOrCreateAccount(store)` — recover or generate an ACME account key
- `createRenewalScheduler(onRenew)` — timer-based renewal at 30 days remaining

### Site (`site/index.ts`)
- `dispatch(req, ctx, sites)` — host + route lookup with compression
- `createChallengeStore()` — in-memory ACME http-01 token store

## Types

```ts
type EdgeConfig = {
  acme?: { email: string; directoryUrl?: string; storage: string | { directory: string } }
  sites: ReadonlyArray<{
    host: string                              // "example.com" or "*.example.com"
    routes: ReadonlyArray<{
      match?: { path?: RegExp | string; method?: string | string[] }
      handler: (req, ctx) => Promise<Response>
    }>
    compress?: ReadonlyArray<"gzip" | "zstd">
  }>
  insecure?: boolean       // skip TLS (useful for tests)
  httpPort?: number        // default 80
  httpsPort?: number       // default 443
}

type ForwardContext = { remoteIp: string; tls: boolean; host: string }
```

## Usage

```ts
import { defineEdge, proxy, files } from "@atlas/edge"

defineEdge({
  acme: { email: "you@example.com", storage: "/var/atlas/edge" },
  sites: [{
    host: process.env.DOMAIN!,
    compress: ["gzip", "zstd"],
    routes: [
      { match: { path: /^\/[^/]+\/[^/]+\.git(?:\/.*)?$/ }, handler: proxy("http://api:3000") },
      { match: { path: "/static/*" }, handler: files({ root: "./public", stripPrefix: "/static" }) },
      { handler: proxy("http://web:3001") }, // catch-all
    ],
  }],
}).listen()
```

## Behaviour

- **Localhost dev** — if every site host matches `isLocalHost`, the edge
  starts a single plain-HTTP listener (no ACME, no :443). No certificate
  setup is required for development.
- **Production** — :80 serves ACME http-01 challenges and 308-redirects
  everything else to https. :443 terminates TLS using SNI-keyed certs and
  dispatches requests to sites by Host header.
- **Cert lifecycle** — on first run, missing certs are issued via LE prod
  (override with `directoryUrl: LETSENCRYPT_STAGING` for testing). Certs
  persist to `<storage>/certs/<key>/{cert,key,meta}.pem` plus a single
  `<storage>/account.json` ACME account key. A renewal timer fires 30
  days before `notAfter` and `server.reload({ tls })` swaps in the new
  pair without dropping connections.
- **Proxy headers** — every forwarded request gets `X-Real-IP`,
  `X-Forwarded-For` (appended), `X-Forwarded-Proto`, `X-Forwarded-Host`.
  Hop-by-hop headers are stripped. `Host` is rewritten to the upstream
  unless `proxy(url, { preserveHost: true })`.
- **Compression** — gzip is always available; zstd is enabled only when
  the running Bun build exposes `Bun.zstdCompressSync`. Brotli is not
  implemented — browsers fall back to gzip.

## Testing

```sh
bun test packages/edge/
```

Tests cover the DER encoder, JWS signing, host/route matchers, the
proxy header policy, and the renewal scheduler. End-to-end ACME flow is
not unit-tested — point at `LETSENCRYPT_STAGING` for live verification.
