import { get, post, pipe, json, withAuth } from "@atlas/server"
import { db } from "../db.ts"

export const apiRoutes = [
  get("/api/health", pipe((c) => json(c, 200, { healthy: true }))),

  get("/api/users", pipe(
    withAuth(),
    async (c) => {
      const rows = await db.query("select id, email, name, role, created from users")
      return json(c, 200, rows)
    },
  )),

  get("/api/posts", pipe(
    async (c) => {
      const rows = await db.query(
        "select p.id, p.title, p.body, p.published, p.created, u.name as author from posts p join users u on p.author_id = u.id where p.published = true order by p.created desc",
      )
      return json(c, 200, rows)
    },
  )),

  post("/api/posts", pipe(
    withAuth(),
    async (c) => {
      const body = await c.req.json()
      const { title, body: postBody, authorId } = body
      const row = await db.query(
        "insert into posts (title, body, author_id) values ($1, $2, $3) returning id, title, created",
        [title, postBody, authorId],
      )
      return json(c, 201, row[0])
    },
  )),
]
