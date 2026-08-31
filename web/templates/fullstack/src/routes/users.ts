import { from } from "@atlas/db"
import { get, json, parseJson, pipe, pipeline, post } from "@atlas/server"
import { db } from "../db.ts"
import { users } from "../schema.ts"

const parsed = pipeline(parseJson)

export const userRoutes = [
  get("/api/users", pipe(async (c) => {
    const rows = await db.all(
      from(users).select("id", "email", "name", "created").orderBy("created", "DESC"),
    )
    return json(c, 200, rows)
  })),

  post("/api/users", parsed(async (c) => {
    const { email, name } = c.body as { email: string; name: string }
    const rows = await db.execute(
      from(users).insert({ email, name }).returning("id", "email", "name", "created"),
    )
    return json(c, 201, rows[0] ?? null)
  })),
]
