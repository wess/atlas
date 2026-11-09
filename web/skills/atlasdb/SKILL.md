---
name: atlasdb
description: Work with databases in Atlas using @wess/atlas/db and @wess/atlas/migrate. Use for defining schemas, writing queries with from(), validating input with changesets, transactions, or creating and running migrations on Postgres or SQLite.
---

# Atlas database

## Schema and connection

```ts
import { column, defineSchema, type RowOf } from "@wess/atlas/db"
import { connect } from "@wess/atlas/db/sqlite"

export const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  bio: column.text().nullable(),
  active: column.boolean().default(true),
  created: column.timestamp().defaultRaw("CURRENT_TIMESTAMP"),
})

export type User = RowOf<typeof users>

export const db = connect({ path: "./app.db" })
```

For Postgres, use `connect({ url, pool })` from `@wess/atlas/db/postgres`. Importing the driver you use keeps the other out of the app. Column types: `serial text integer bigint real boolean timestamp json<T> uuid`. Modifiers: `primaryKey unique nullable default defaultRaw ref(table, col)`. Derive row types with `RowOf`; don't write them by hand.

## Queries

Rows are typed from the schema. Conditions are always `q("column").op(value)`.

```ts
import { from } from "@wess/atlas/db/query"

export const examples = async () => {
  const all = await db.all(from(users))
  const picked = await db.all(from(users).select("id", "email"))
  const one = await db.one(from(users).where((q) => q("id").equals(1)))
  const page = await db.all(from(users).orderBy("created", "DESC").limit(20).offset(40))
  const [created] = await db.execute(from(users).insert({ email: "a@b.co" }).returning("id"))
  await db.execute(from(users).update({ bio: "hi" }).where((q) => q("id").equals(1)))
  await db.execute(from(users).del().where((q) => q("id").equals(1)))
  return { all, picked, one, page, created }
}
```

`db.all` returns rows, `db.one` returns a row or null, and `db.execute` runs writes. Also on the chain: `join`, `leftJoin`, `innerJoin`, `groupBy`, `having`, `distinct`, `insertMany`, `onConflict`, `cte`, `recursiveCte`, `toSql`. Use `from("table")` for dynamic tables and `raw(sql, ...values)` for fragments. Never build SQL with string concatenation.

## Validating input

```ts
import { changeset } from "@wess/atlas/db/changeset"

export const userChanges = changeset(users, { cast: ["email", "bio"], required: ["email"] })
```

Call it with untrusted data to get a result holding the validated changes or errors. Any validator with `safeParse`, including Zod, works through `validate`.

## Transactions

Use `tx` inside the callback, not `db`.

```ts
import { from } from "@wess/atlas/db/query"

export const rename = (id: number, email: string) =>
  db.transaction(async (tx) => {
    await tx.execute(from(users).update({ email }).where((q) => q("id").equals(id)))
  })
```

## Migrations

Generate them from the schema rather than writing SQL.

```ts
import { migrate } from "@wess/atlas/migrate"

await migrate.diff(db, [users], { name: "addusers", dir: "./migrations" })
await migrate.up(db, "./migrations")
```

`migrate.diff` writes up and down SQL for new tables and added or removed columns, or returns `{ noop: true }`. Type and nullability changes come out as `-- ALTER` comments, so read and resolve them before applying.

`.unique()` becomes a constraint on new tables and a `CREATE UNIQUE INDEX` on existing ones, which fails on apply if the data already has duplicates, so clean those up first. Removing `.unique()` is flagged as a comment for you to resolve. `.default(value)` and `.defaultRaw(sql)` are both written to the DDL. Still read the generated SQL before running it.

Also `migrate.plan`, `migrate.status`, `migrate.down`, and `migrate.create(dir, name)` for hand-written migrations.
