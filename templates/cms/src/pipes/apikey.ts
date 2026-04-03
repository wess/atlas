import { pipe, withCors, withJson, halt, assign } from "@atlas/server"
import { db } from "../db.ts"

export const apiKeyAuth = pipe(
  withCors(),
  withJson(),
  async (c) => {
    const key = c.headers.get("x-api-key")

    if (!key) {
      return halt(c, 401, { error: "API key required" })
    }

    const rows = await db.query(
      "select id, name, key, permissions, created_at, last_used_at from api_keys where key = $1",
      [key],
    )

    if (rows.length === 0) {
      return halt(c, 401, { error: "Invalid API key" })
    }

    const record = rows[0]

    await db.query(
      "update api_keys set last_used_at = datetime('now') where id = $1",
      [record.id],
    )

    return assign(c, { apiKey: record })
  },
)
