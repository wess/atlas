# @atlas/cache

Thin wrapper around Bun.redis for key-value caching with JSON serialization.

## Types

### Cache

```ts
type Cache = {
  get: <T>(key: string) => Promise<T | null>
  set: (key: string, value: unknown, opts?: { ttl?: number }) => Promise<void>
  del: (key: string) => Promise<void>
  expire: (key: string, seconds: number) => Promise<void>
  flush: () => Promise<void>
  close: () => Promise<void>
}
```

## Exports

### `createCache({ url })`
Creates a Cache backed by `Bun.redis`. Values are JSON serialized automatically.
`set` with `ttl` uses Redis EX (seconds). `flush` runs FLUSHDB.

### `createMemoryCache()`
In-memory Cache implementation for testing. Same interface, no Redis needed.

### `cached(cache, prefix, fn, opts?)`
Cache-aside helper. Wraps an async function with automatic caching.
Keys are built as `prefix:arg1:arg2:...`. Returns cached value on hit,
calls `fn` and stores result on miss.

### `invalidate(cache, prefix, ...args)`
Deletes the cache key for the given prefix and args, forcing a fresh fetch
on the next `cached()` call.

## Usage

```ts
import { createMemoryCache, cached, invalidate } from "@atlas/cache"

const cache = createMemoryCache()

const getUser = cached(cache, "user", async (id: string) => {
  return await db.query("SELECT * FROM users WHERE id = ?", [id])
}, { ttl: 60 })

const user = await getUser("123") // fetches from db
const again = await getUser("123") // returns cached

await invalidate(cache, "user", "123") // bust cache
```

## Testing

```sh
bun test packages/cache/
```

Tests use `createMemoryCache()` so no Redis instance is required.
