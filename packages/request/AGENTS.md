# @atlas/request

HTTP client for outbound API/web requests, built on fetch.

## Exports

### `request(url, opts?)`

One-off HTTP request. Accepts `RequestOptions` with optional `method`, `headers`, `json`, `body`, and `retry`.

```ts
import { request } from "@atlas/request"

const res = await request("https://api.example.com/data", {
  method: "POST",
  json: { name: "atlas" },
})
```

When `json` is provided, the body is serialized and `content-type: application/json` is set automatically.

### `createClient(opts)`

Returns a `Client` with preconfigured `baseUrl`, default `headers`, optional `retry`, and `interceptors`.

```ts
import { createClient } from "@atlas/request"

const api = createClient({
  baseUrl: "https://api.example.com",
  headers: { authorization: "Bearer tok_123" },
  retry: { attempts: 3 },
})

const res = await api.get("/users")
const created = await api.post("/users", { json: { name: "Wess" } })
```

### `Client` type

```ts
{
  get(path, opts?): Promise<Response>
  post(path, opts?): Promise<Response>
  put(path, opts?): Promise<Response>
  patch(path, opts?): Promise<Response>
  del(path, opts?): Promise<Response>
  request(path, opts?): Promise<Response>
}
```

### `withRetry(fn, opts?)`

Wraps a fetch call with retry logic. Options: `attempts` (default 3), `delay` (default 1000ms), `backoff` (default 2x), `retryOn` (default: status >= 500).

```ts
import { withRetry } from "@atlas/request"

const res = await withRetry(() => fetch("https://api.example.com/health"), {
  attempts: 5,
  delay: 500,
})
```

### Interceptors

Request and response interceptors transform the url/init or response in sequence.

```ts
import { createClient } from "@atlas/request"

const client = createClient({
  baseUrl: "https://api.example.com",
  interceptors: {
    request: [(url, init) => ({ url, init: { ...init, headers: { ...init.headers as any, "x-trace": "abc" } } })],
    response: [(res) => { console.log(res.status); return res }],
  },
})
```

### Providers

Preconfigured clients for common APIs. Import from `@atlas/request/providers`.

```ts
import { github, stripe, openai, resend } from "@atlas/request/providers"

const gh = github({ token: process.env.GITHUB_TOKEN! })
const res = await gh.get("/user")

const mail = resend({ key: process.env.RESEND_KEY! })
await mail.post("/emails", { json: { to: "user@example.com", subject: "Hi" } })
```

Available providers: `github`, `stripe`, `openai`, `resend`.

## File structure

- `client/index.ts` -- request(), createClient(), types
- `retry/index.ts` -- withRetry()
- `interceptors/index.ts` -- interceptor types and apply functions
- `providers/index.ts` -- preconfigured clients
- `index.ts` -- re-exports

## Types

- `RequestOptions = { method?, headers?, json?, body?, retry?, signal?, ... }`
- `Client = { get, post, put, patch, del, request }` — all return `Promise<Response>`
- `ClientOptions = { baseUrl, headers?, retry?, interceptors? }`
- `RetryOptions = { attempts?, delay?, backoff?, retryOn? }`
- `Interceptors = { request?: RequestInterceptor[]; response?: ResponseInterceptor[] }`
- `RequestInterceptor = (url, init) => { url, init }` (or Promise of)
- `ResponseInterceptor = (res) => Response` (or Promise of)

## Dependencies

- Sibling packages: none — `@atlas/request` is standalone.
- External: none. Built on the platform `fetch`.

## Testing

```sh
bun test packages/request/
```
