import { get, post, pipe, json, withAuth } from "@atlas/server"
import { db } from "../db.ts"

export const userRoutes = [
  get("/api/users", pipe(
    withAuth(),
    async (c) => {
      const rows = await db.query("select id, email, name, created from users")
      return json(c, 200, rows)
    },
  )),

  post("/api/users", pipe(
    async (c) => {
      const body = await c.req.json()
      const { email, name } = body
      const row = await db.query(
        "insert into users (email, name) values ($1, $2) returning id, email, name, created",
        [email, name],
      )
      return json(c, 201, row[0])
    },
  )),
]
