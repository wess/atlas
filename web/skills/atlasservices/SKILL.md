---
name: atlasservices
description: Use Atlas's integration modules for object storage, Redis caching, transactional email, push notifications, Stripe billing, outbound HTTP, and share links. Use when an Atlas app needs any of these, before adding a third-party SDK.
---

# Atlas services

These wrap Bun and Web APIs, so don't add AWS, Redis, or Stripe SDKs.

## Storage: `@wess/atlas/storage`

```ts
import { createStore, presign, remove, upload } from "@wess/atlas/storage"

const store = createStore({ endpoint: "https://s3.test", bucket: "files", region: "auto", accessKey: "k", secretKey: "s" })

export const save = async (file: File) => {
  await upload(store, { key: `avatars/${file.name}`, body: file, contentType: file.type, maxBytes: 5_000_000 })
  return presign(store, `avatars/${file.name}`, { expires: 3600 })
}

export const drop = (key: string) => remove(store, key)
```

Also `download`, `list`, and `stat` (null on 404). Set `maxBytes` yourself; the default is 5 GiB. Any S3-compatible service works.

## Cache: `@wess/atlas/cache`

```ts
import { cached, createMemoryCache, invalidate } from "@wess/atlas/cache"

const cache = createMemoryCache()
const userById = cached(cache, "user", async (id: string) => ({ id }), { ttl: 60 })

export const read = async (id: string) => {
  const user = await userById(id)
  await invalidate(cache, "user", id)
  return user
}
```

Use `createCache({ url })` for Redis. Misses for the same key share one load.

## Email: `@wess/atlas/email`

```ts
import { createEmailer, escapeHtml, layout } from "@wess/atlas/email"

const emailer = createEmailer({ apiKey: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM })

export const welcome = (to: string, name: string) =>
  emailer.send({
    to,
    subject: "Welcome",
    html: layout({ title: "Welcome", body: `<p>Hello ${escapeHtml(name)}</p>` }),
  })
```

With no key it logs to the console, which suits development. Check `result.ok` rather than expecting a throw. Templates: `inviteEmail`, `passwordResetEmail`.

## Outbound HTTP: `@wess/atlas/request`

```ts
import { createClient } from "@wess/atlas/request"

const api = createClient({ baseUrl: "https://api.test", timeout: 5000 })

export const fetchThing = () => api.get("/things")
```

Clients return a `Response`. Also `request(url, opts)` and `withRetry(fn, opts)`; presets for `github`, `stripe`, `openai`, and `resend` are in `/request/providers`.

## Share links: `@wess/atlas/share`

```ts
import { shareUrl } from "@wess/atlas/share"

export const tweet = shareUrl("twitter", { url: "https://app.test", title: "Look" })
```

## Larger modules

Read the reference first with `atlas docs <module>`, because these need app-owned stores:

- **`billing`:** Stripe checkout, portal, webhooks (`createBilling`), and Connect marketplace payments (`createConnect`).
- **`notify`:** APNs and FCM push (`createConfiguredNotifier`).
- **`edge`:** TLS reverse proxy with Let's Encrypt (`defineEdge`); don't bring Caddy or nginx.
- **`mcp`:** expose docs and runtime inspection to agents (`createMcpServer`).
