# @atlas/config

Typed environment variable access and config resolution for Bun apps.

## Exports

- `env(name, opts?)` → `EnvRef<T>` — reference to an env var, resolved lazily
  - `opts.parse`: `(string) => T` — transform the raw string
  - `opts.default`: `string` — fallback if var is missing
- `defineConfig(schema)` → `Readonly<ResolvedSchema>` — resolve all env refs into a frozen config object

## Types

- `EnvRef<T>` — `{ read: () => T }` — lazy reference to an env var
- `ResolveConfig<T>` — recursively resolves EnvRef values in a config schema

## Usage

```ts
import { defineConfig, env } from "@atlas/config"

const config = defineConfig({
  database: {
    url: env("DATABASE_URL"),
    pool: env("DB_POOL_SIZE", { parse: Number, default: "5" }),
  },
  http: {
    port: env("PORT", { parse: Number, default: "3000" }),
  },
})

// config.database.url → string
// config.http.port → number
```

## Depends on

Nothing. Zero dependencies.
