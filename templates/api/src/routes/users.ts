import { hash, requireAuth } from "@atlas/auth"
import { from } from "@atlas/db"
import { del, get, json, parseJson, pipeline, post, put } from "@atlas/server"
import { config } from "../config.ts"
import { db } from "../db.ts"
import { users } from "../schema.ts"

const guard = pipeline(requireAuth({ secret: config.authSecret }))
const authed = pipeline(requireAuth({ secret: config.authSecret }), parseJson)
const parsed = pipeline(parseJson)

export const userRoutes = [
  get("/api/users", guard(async (c) => {
    const rows = await db.all(from(users).select("id", "email", "name", "created"))
    return json(c, 200, rows)
  })),

  get("/api/users/:id", guard(async (c) => {
    const row = await db.one(
      from(users)
        .select("id", "email", "name", "created")
        .where(q => q("id").equals(Number(c.params.id))),
    )
    return row ? json(c, 200, row) : json(c, 404, { error: "User not found" })
  })),

  post("/api/users", parsed(async (c) => {
    const { email, name, password } = c.body as { email: string; name: string; password: string }
    const rows = await db.execute(
      from(users)
        .insert({ email, name, password_hash: await hash(password) })
        .returning("id", "email", "name", "created"),
    )
    return json(c, 201, rows[0] ?? null)
  })),

  put("/api/users/:id", authed(async (c) => {
    const { name, email } = c.body as { name: string; email: string }
    const rows = await db.execute(
      from(users)
        .where(q => q("id").equals(Number(c.params.id)))
        .update({ name, email, updated: new Date().toISOString() })
        .returning("id", "email", "name"),
    )
    return rows[0] ? json(c, 200, rows[0]) : json(c, 404, { error: "User not found" })
  })),

  del("/api/users/:id", guard(async (c) => {
    await db.execute(from(users).where(q => q("id").equals(Number(c.params.id))).del())
    return json(c, 204, null)
  })),
]
