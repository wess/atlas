import { get, post, put, del, pipe, json, withAuth } from "@atlas/server"
import { db } from "../db.ts"

export const userRoutes = [
  get("/api/users", pipe(
    withAuth(),
    async (c) => {
      const rows = await db.query("select id, email, name, created from users")
      return json(c, 200, rows)
    },
  )),

  get("/api/users/:id", pipe(
    withAuth(),
    async (c) => {
      const row = await db.query("select id, email, name, created from users where id = $1", [c.params.id])
      return row.length > 0
        ? json(c, 200, row[0])
        : json(c, 404, { error: "User not found" })
    },
  )),

  post("/api/users", pipe(
    async (c) => {
      const body = await c.req.json()
      const { email, name, password } = body
      const row = await db.query(
        "insert into users (email, name, password_hash) values ($1, $2, $3) returning id, email, name, created",
        [email, name, password],
      )
      return json(c, 201, row[0])
    },
  )),

  put("/api/users/:id", pipe(
    withAuth(),
    async (c) => {
      const body = await c.req.json()
      const { name, email } = body
      const row = await db.query(
        "update users set name = $1, email = $2, updated = now() where id = $3 returning id, email, name",
        [name, email, c.params.id],
      )
      return row.length > 0
        ? json(c, 200, row[0])
        : json(c, 404, { error: "User not found" })
    },
  )),

  del("/api/users/:id", pipe(
    withAuth(),
    async (c) => {
      await db.query("delete from users where id = $1", [c.params.id])
      return json(c, 204, null)
    },
  )),
]
