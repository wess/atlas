# @atlas/db

Functional query builder, schema definitions, changesets, and database drivers for Postgres and SQLite.

## Exports

### Query Builder
- `from(table: string | Schema, alias?: string) => Chainable` - entry point for all queries
- `raw(sql: string, ...values: any[]) => Fragment` - raw SQL fragment with bind values
- `isFragment(value: unknown) => boolean` - type guard for Fragment
- `createWhereBuilder() => WhereBuilder` - standalone predicate builder

### Chainable Methods
Select: `.select(...cols)`, `.distinct(...cols)`, `.where(cb)`, `.join(t, on, alias?)`,
`.leftJoin(t, on, alias?)`, `.innerJoin(t, on, alias?)`, `.orderBy(col, dir?, nulls?)`,
`.groupBy(...cols)`, `.having(cb)`, `.limit(n)`, `.offset(n)`, `.returning(...cols)`

Mutate: `.insert(data)`, `.insertMany(data[])`, `.insertFrom(cols, source)`,
`.update(data)`, `.del()`, `.truncate(cascade?)`

Advanced: `.onConflict(spec)`, `.cte(name, sub)`, `.recursiveCte(name, sub)`

Terminal: `.toSql(dialect?) => SqlResult`, `.toQuery() => Query`

### Schema
- `defineSchema(table: string, columns: T) => Schema<T>` - define a table schema
- `column.serial()`, `.text()`, `.integer()`, `.bigint()`, `.real()`, `.boolean()`,
  `.timestamp()`, `.json()`, `.uuid()` - column type builders
- Column modifiers: `.primaryKey()`, `.unique()`, `.nullable()`, `.default(val)`, `.ref(table, col)`

### Changeset
- `changeset(schema, opts: { cast, required?, validate? }) => (data) => ChangesetResult`

### Drivers
- `connect(opts: ConnectOptions) => Connection`
  - sqlite: `{ driver: "sqlite", path: string }`
  - postgres: `{ driver: "postgres", url: string, pool?: number }`

## Key Types

```ts
type Dialect = "postgres" | "sqlite"
type SqlResult = { text: string, values: readonly any[] }
type Schema<T> = { table: string, columns: T }
type Connection = { dialect: Dialect, execute(q: SqlResult): Promise<any[]>,
  one(q: SqlResult): Promise<any>, all(q: SqlResult): Promise<any[]>,
  transaction<T>(fn: (conn: Connection) => Promise<T>): Promise<T>, close(): void }
type ChangesetResult<T> = { valid: boolean, changes: Partial<T>,
  errors: Record<string, string[]> }
```

## Usage

```ts
import { connect, defineSchema, column, from, changeset } from "@atlas/db"
import { z } from "zod"

// 1. define schema
const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  name: column.text(),
  email: column.text().unique(),
})

// 2. connect
const db = connect({ driver: "sqlite", path: ":memory:" })

// 3. build & run queries
const insert = from(users).insert({ name: "Ada", email: "ada@example.com" })
  .returning("id").toSql("sqlite")
await db.execute(insert)

const rows = await db.all(
  from(users).select("id", "name").where(q => q("name").like("%Ada%")).toSql("sqlite")
)

// 4. validate input
const validate = changeset(users, {
  cast: ["name", "email"] as const,
  required: ["name", "email"] as const,
  validate: { email: z.string().email() },
})
const result = validate({ name: "", email: "bad" })
// result.valid === false, result.errors contains field errors
```

## Where Callback

```ts
from("users").where(q => q("age").greaterThan(18))
from("users").where(q => q.or(q("role").equals("admin"), q("role").equals("mod")))
from("users").where(q => q.raw(raw("active = ?", true)))
```

## Dependencies

Sibling: none. External: `zod` (changeset validation). Runtime: `Bun.sql` (postgres), `bun:sqlite`.
