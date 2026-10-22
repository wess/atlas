# @wess/atlas/server

Bun.serve wrapper with an Elixir Plug-inspired pipe system.

## Exports

### Conn (`conn/index.ts`)
- `Conn` — immutable connection type carrying request/response state
- `createConn(req, params?)` — create Conn from a Request
- `assign(conn, data)` — merge data into conn.assigns
- `putHeader(conn, key, value)` — add a response header
- `halt(conn, status, body?)` — stop pipeline, set status
- `setStatus(conn, status)` — set response status

### Pipe (`pipe/index.ts`)
- `PipeFn` — type: `(conn: Conn) => Conn | Promise<Conn>`
- `pipe(fn)` — identity wrapper for type inference
- `pipeline(...pipes)(handler)` — compose pipes, short-circuits on halt

### Router (`router/index.ts`)
- `Route` — type: `{ method, pattern, handler }`
- `get(path, handler)` — create GET route
- `post(path, handler)` — create POST route
- `put(path, handler)` — create PUT route
- `patch(path, handler)` — create PATCH route
- `del(path, handler)` — create DELETE route
- `head(path, handler)` — create HEAD route
- `options(path, handler)` — create OPTIONS route
- `router(...routes)` — create fetch handler from Route objects
- `serve(options)` — start Bun.serve with routes, port, hostname, websocket

### Typed routes (`route/index.ts`)
- `route(method, path, schemas, handler)` — Route with validated, typed input
- `getR | postR | putR | patchR | delR` — method-specific shortcuts
- `Validator<T>` — `(input: unknown) => T` *or* `{ parse(input): T }` (Zod-compatible)
- `RouteSchemas<P, B, Q, A>` — `{ params?, body?, query?, before?, assigns? }`
- `TypedConn<P, B, Q, A>` — `Conn` with narrowed `params`, `body`, `query`, `assigns`

```ts
import { getR, postR, pipeline } from "@wess/atlas/server"
import { requireAuth } from "@wess/atlas/auth"

postR(
  "/users/:groupId",
  {
    params: z.object({ groupId: z.coerce.number() }),
    body: z.object({ email: z.string().email(), name: z.string().min(1) }),
    before: [requireAuth({ secret })],
    assigns: {} as { auth: { id: number } },
  },
  async (c) => {
    // c.params.groupId: number
    // c.body: { email: string; name: string }
    // c.assigns.auth.id: number
    return json(c, 201, await createUser(c.assigns.auth.id, c.params.groupId, c.body))
  },
)
```

Validation failures throw `unprocessable("Invalid <where>")` with `code: "VALIDATION_FAILED"`
and `details: { where, issues }`. JSON body parsing happens automatically when a `body`
schema is provided — no need to add `parseJson` to `before`.

### Response (`response/index.ts`)
- `json(conn, status, data)` — JSON response, sets content-type
- `text(conn, status, body)` — plain text response
- `redirect(conn, location, status?)` — redirect (default 302)
- `stream(conn, status, readable)` — streaming response

### Parsers (`parsers/index.ts`)
- `parseJson` — pipe that parses JSON body
- `parseForm` — pipe that parses URL-encoded form body
- `parseMultipart` — pipe that parses multipart form data

### Errors (`errors/index.ts`)
- `HttpError` — tagged error object: `{ status, message, code?, details?, headers? }`
- `httpError(status, message, opts?)` — build an `HttpError`
- `isHttpError(value)` — type guard; routers/onError use it to render the right status
- `badRequest`, `unauthorized`, `forbidden`, `notFound`, `methodNotAllowed`, `conflict`,
  `gone`, `unprocessable`, `tooManyRequests`, `internal`, `serviceUnavailable` —
  status-specific factories: `notFound("user not found")` → throws as 404
- `haltWith(conn, error)` — short-circuit the pipeline with an `HttpError` (alternative to `throw`)
- `onError(handler)` — register a custom error handler pipe for the router

### Throw-style error handling

```ts
import { notFound, conflict, get, json, pipe } from "@wess/atlas/server"

get("/users/:id", pipe(async (c) => {
  const user = await db.one(from(users).where(q => q("id").equals(c.params.id)))
  if (!user) throw notFound("user not found")
  return json(c, 200, user)
}))
```

The router catches thrown `HttpError`s and renders them as JSON with the right status,
code, details, and any custom headers. Non-`HttpError`s become 500s with stack traces
logged server-side only.

### Adapter (`adapter/index.ts`)
- `ServerAdapter<TConfig>` — generic adapter type with name + start
- `createAdapter(name, start)` — create a named server adapter
- `compose(adapters)` — start multiple adapters, returns `ComposedServer` with `stop()`

### WebSocket (`ws/index.ts`) — import from `@wess/atlas/server/ws`
- `WsConn<T>` — wrapped websocket connection with auto-JSON send
- `channel(name, handlers)` — define a typed pub/sub channel
- `createRooms()` — room manager with join/leave/broadcast/members
- `ws(config)` — build websocket handler + rooms + upgrade helper
- `wsAdapter` — standalone WS adapter for use with `compose()`

### SSE (`sse/index.ts`) — import from `@wess/atlas/server/sse`
- `SseClient` — client with id, send, close
- `createSseChannel()` — managed SSE channel with broadcast + pipe
- `eventStream(conn, generator)` — one-off SSE response helper

## Usage

```ts
import { pipe, pipeline, router, serve, json, assign, parseJson, get, post } from "@wess/atlas/server"

const logger = pipe((c) => {
  console.log(`${c.method} ${c.path}`)
  return c
})

const authed = pipeline(logger, parseJson)

serve({
  port: 3000,
  routes: [
    get("/", pipe((c) => json(c, 200, { status: "ok" }))),
    get("/users/:id", authed(
      pipe((c) => json(c, 200, { id: c.params.id }))
    )),
    post("/users", authed(
      pipe((c) => json(c, 201, { created: true, body: c.body }))
    )),
  ],
})
```

## Architecture
- All functions are pure and return new Conn (immutable)
- Pipes compose via `pipeline()`, halt short-circuits
- Route builders (`get`, `post`, `put`, etc.) create typed Route objects
- `router(...routes)` matches requests against Route objects
- No classes, fully functional

`serve` accepts `development?: boolean` (default false) and `maxRequestBodySize?: number` (default 1 MiB). Raise the body limit explicitly for upload endpoints. Invalid JSON/forms return 400. SSE queues are bounded to 256 KiB per client; slow consumers are disconnected and must reconnect. Generator failures terminate the stream.
