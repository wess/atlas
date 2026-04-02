# @atlas/server

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
- `router(routes)` — create fetch handler from `"METHOD /path"` route map
- `serve(options)` — start Bun.serve with routes, port, hostname, websocket

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
- `onError(handler)` — create error handler pipe for router

### Adapter (`adapter/index.ts`)
- `ServerAdapter<TConfig>` — generic adapter type with name + start
- `createAdapter(name, start)` — create a named server adapter
- `compose(adapters)` — start multiple adapters, returns `ComposedServer` with `stop()`

### WebSocket (`ws/index.ts`) — import from `@atlas/server/ws`
- `WsConn<T>` — wrapped websocket connection with auto-JSON send
- `channel(name, handlers)` — define a typed pub/sub channel
- `createRooms()` — room manager with join/leave/broadcast/members
- `ws(config)` — build websocket handler + rooms + upgrade helper
- `wsAdapter` — standalone WS adapter for use with `compose()`

### SSE (`sse/index.ts`) — import from `@atlas/server/sse`
- `SseClient` — client with id, send, close
- `createSseChannel()` — managed SSE channel with broadcast + pipe
- `eventStream(conn, generator)` — one-off SSE response helper

## Usage

```ts
import { pipe, pipeline, router, serve, json, assign, parseJson } from "@atlas/server"

const logger = pipe((c) => {
  console.log(`${c.method} ${c.path}`)
  return c
})

const authed = pipeline(logger, parseJson)

serve({
  port: 3000,
  routes: {
    "GET /":        pipe((c) => json(c, 200, { status: "ok" })),
    "GET /users/:id": authed(
      pipe((c) => json(c, 200, { id: c.params.id }))
    ),
    "POST /users":  authed(
      pipe((c) => json(c, 201, { created: true, body: c.body }))
    ),
  },
})
```

## Architecture
- All functions are pure and return new Conn (immutable)
- Pipes compose via `pipeline()`, halt short-circuits
- Router maps `"METHOD /path"` strings to PipeFn handlers
- No classes, fully functional
