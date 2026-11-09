---
name: atlasserver
description: Build HTTP APIs with @wess/atlas/server. Use for routes, pipes and middleware, typed validation, error responses, WebSockets, server-sent events, or security headers in an Atlas app.
---

# Atlas server

A request is an immutable `Conn` passed through pipes. Each pipe returns a new `Conn`; `halt` stops the chain.

## Routes and pipes

```ts
import { assign, get, json, parseJson, pipe, pipeline, post, serve } from "@wess/atlas/server"

const logged = pipe((c) => {
  console.log(c.method, c.path)
  return c
})
const withBody = pipeline(logged, parseJson)

serve({
  port: 3000,
  routes: [
    get("/users/:id", pipe((c) => json(c, 200, { id: c.params.id }))),
    post("/users", withBody(pipe((c) => json(c, 201, { body: c.body })))),
    get("/me", pipe((c) => json(c, 200, assign(c, { seen: true }).assigns))),
  ],
})
```

`serve` is production mode with a 1 MiB body limit; raise it with `maxRequestBodySize`. For a fetch handler, use `router(...routes)`. Other helpers: `put`, `patch`, `del`, `text`, `redirect`, `stream`, `putHeader`, `setStatus`, `parseForm`, `parseMultipart`.

## Typed routes

Prefer these over parsing by hand. A `body` schema parses JSON itself, so don't add `parseJson` to `before`. Validators can be Zod, a function, or anything with `.parse`.

```ts
import { requireAuth } from "@wess/atlas/auth/flows"
import { json, postR } from "@wess/atlas/server"
import { z } from "zod"

type Auth = { auth: { id: number } }

export const createPost = postR<{ groupId: number }, { content: string }, Record<string, string>, Auth>(
  "/groups/:groupId/posts",
  {
    params: z.object({ groupId: z.coerce.number() }),
    body: z.object({ content: z.string().min(1).max(280) }),
    before: [requireAuth({ secret })],
    assigns: {} as Auth,
  },
  (c) => json(c, 201, { author: c.assigns.auth.id, group: c.params.groupId, content: c.body.content }),
)
```

Also `getR`, `putR`, `patchR`, `delR`, and `route(method, path, schemas, handler)`. Validation failures return 422 automatically.

## Errors

Throw them; the router renders `{ error, code?, details? }`. Don't repeat `halt(c, 404, ...)` branches.

```ts
import { conflict, notFound, tooManyRequests } from "@wess/atlas/server"

export const guard = (row: unknown, duplicate: boolean, limited: boolean) => {
  if (!row) throw notFound("user")
  if (duplicate) throw conflict("email taken", { code: "DUP_EMAIL" })
  if (limited) throw tooManyRequests("slow down", { headers: { "Retry-After": "60" } })
}
```

Also `badRequest`, `unauthorized`, `forbidden`, `gone`, `unprocessable`, `internal`, `serviceUnavailable`, `httpError(status, message, opts)`.

## WebSockets

```ts
import { serve } from "@wess/atlas/server"
import { channel, createRooms, type WsConfig } from "@wess/atlas/server/ws"

const rooms = createRooms()

const chat = channel("chat", {
  join: (ws, params) => {
    rooms.join(ws, String(params.room))
    return true
  },
  handle: (_ws, event, payload) => {
    if (event === "message") rooms.broadcast("general", payload as object)
  },
})

const websocket: WsConfig = { channels: [chat], onClose: (ws) => rooms.leaveAll(ws) }

serve({ port: 3000, routes: [], websocket })
```

Clients connect to `/ws` and send `{ channel, event, payload }`.

## Server-sent events

```ts
import { get, serve } from "@wess/atlas/server"
import { createSseChannel } from "@wess/atlas/server/sse"

const events = createSseChannel()

serve({ port: 3000, routes: [get("/events", events.pipe)] })

events.broadcast("notification", { text: "hello" })
```

## Security

```ts
import { router } from "@wess/atlas/server"
import { clientIp, createMemoryRateLimit, parseTrustedProxies, withSecurityHeaders } from "@wess/atlas/security"

const secured = withSecurityHeaders(router(), { dev: false })
const limiter = createMemoryRateLimit()
const trustedProxies = parseTrustedProxies(process.env.TRUSTED_PROXIES)

export const allowed = async (req: Request) => {
  // never read X-Forwarded-For yourself
  const ip = clientIp(req, { trustedProxies })
  return (await limiter.check(`login:${ip}`, 10, 900)).ok
}

Bun.serve({ port: 3000, fetch: secured })
```

Use `createDbRateLimit({ db })` when running more than one process.

## Serving a web app

Serve the same HTML for `/` and every client path, and register it after the API routes: `get("/app/*", shell)`.
