# @atlas/migrate

Database migration manager using `@atlas/db` for Postgres and SQLite.

## Exports

### Migration Operations
- `up(db: Connection, dir?: string) => Promise<string[]>` - run pending migrations, returns names of applied
- `down(db: Connection, dir?: string) => Promise<string | null>` - rollback most recent migration
- `status(db: Connection, dir?: string) => Promise<MigrationStatus[]>` - list all migrations with applied status
- `ensureTable(db: Connection) => Promise<void>` - create `schema_migrations` table if missing

### File Operations
- `createMigration(dir: string, name: string) => MigrationFile` - scaffold new migration folder with up.sql/down.sql
- `scanMigrations(dir: string) => MigrationFile[]` - scan directory for migration folders, sorted by name

### Diff (schema → migration)
- `plan(db, schemas) => Promise<DiffPlan>` — compute up/down SQL by introspecting the
  live DB and comparing it to a list of `defineSchema()` results. Read-only.
- `writeDiff(db, schemas, { dir?, name? }) => Promise<DiffWriteResult>` — same plan,
  but writes a new timestamped migration folder with `up.sql`/`down.sql` if the diff
  is non-empty. Returns `{ noop: true, path: null }` when the schema is in sync.

```ts
import { migrate } from "@atlas/migrate"
import { users, posts } from "./schema"

const result = await migrate.diff(db, [users, posts], { name: "add_users" })
if (result.noop) console.log("schema in sync; nothing to write")
else console.log(`wrote ${result.path}`)
```

Postgres uses `information_schema`; SQLite uses `pragma table_info`. Type/nullability
mismatches are emitted as `-- ALTER table.col …` comments so destructive migrations
land in front of the user instead of running silently. `serial`/`integer` and PK
nullability quirks are normalized — they won't show up as spurious diffs.

### Convenience
- `migrate` - namespace object with `{ up, down, status, create, ensureTable, diff, plan }`

## Types

```ts
type MigrationFile = {
  name: string        // "20260402_add_users"
  timestamp: string   // "20260402"
  upPath: string      // full path to up.sql
  downPath: string    // full path to down.sql
}

type MigrationStatus = {
  name: string
  appliedAt: Date | null  // null = pending
}
```

## Migration Directory Structure

```
migrations/
  20260402_add_users/
    up.sql
    down.sql
  20260403_add_posts/
    up.sql
    down.sql
```

## Usage

```ts
import { connect } from "@atlas/db"
import { migrate } from "@atlas/migrate"

const db = connect({ driver: "sqlite", path: "./app.db" })

// create a new migration
migrate.create("./migrations", "add_users")

// run all pending
const ran = await migrate.up(db, "./migrations")

// check status
const statuses = await migrate.status(db, "./migrations")

// rollback last
const rolled = await migrate.down(db, "./migrations")

await db.close()
```

## Dependencies

Sibling: `@atlas/db`. Runtime: `bun:sqlite`, `node:fs`.
