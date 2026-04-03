import { get, post, del, json } from "@atlas/server"
import { db } from "../db.ts"
import { authed, public_ } from "../pipes/auth.ts"
import { notifyUser } from "../channels/notifications.ts"

export const postRoutes = [
  post("/api/posts", authed(
    async (c) => {
      const { content, imageUrl } = await c.req.json()

      if (!content) {
        return json(c, 400, { error: "content is required" })
      }

      const rows = await db.query(
        `insert into posts (user_id, content, image_url)
         values ($1, $2, $3)
         returning id, user_id, content, image_url, created_at`,
        [c.auth.userId, content, imageUrl || null],
      )

      return json(c, 201, rows[0])
    },
  )),

  get("/api/posts/:id", public_(
    async (c) => {
      const rows = await db.query(
        `select p.id, p.user_id, p.content, p.image_url, p.created_at,
          u.username, u.name, u.avatar_url,
          (select count(*) from likes where post_id = p.id) as like_count
         from posts p
         join users u on u.id = p.user_id
         where p.id = $1`,
        [c.params.id],
      )

      return rows.length > 0
        ? json(c, 200, rows[0])
        : json(c, 404, { error: "Post not found" })
    },
  )),

  del("/api/posts/:id", authed(
    async (c) => {
      const rows = await db.query(
        "select user_id from posts where id = $1",
        [c.params.id],
      )

      if (rows.length === 0) {
        return json(c, 404, { error: "Post not found" })
      }

      if (rows[0].user_id !== c.auth.userId) {
        return json(c, 403, { error: "Not authorized to delete this post" })
      }

      await db.query("delete from likes where post_id = $1", [c.params.id])
      await db.query("delete from posts where id = $1", [c.params.id])

      return json(c, 200, { deleted: true })
    },
  )),

  post("/api/posts/:id/like", authed(
    async (c) => {
      const postId = Number(c.params.id)

      const existing = await db.query(
        "select id from likes where user_id = $1 and post_id = $2",
        [c.auth.userId, postId],
      )

      if (existing.length > 0) {
        return json(c, 409, { error: "Already liked this post" })
      }

      await db.query(
        "insert into likes (user_id, post_id) values ($1, $2)",
        [c.auth.userId, postId],
      )

      const postRows = await db.query("select user_id from posts where id = $1", [postId])
      if (postRows.length > 0 && postRows[0].user_id !== c.auth.userId) {
        notifyUser(postRows[0].user_id, { type: "like", postId, fromUserId: c.auth.userId })
      }

      return json(c, 201, { liked: true })
    },
  )),

  del("/api/posts/:id/like", authed(
    async (c) => {
      await db.query(
        "delete from likes where user_id = $1 and post_id = $2",
        [c.auth.userId, Number(c.params.id)],
      )

      return json(c, 200, { unliked: true })
    },
  )),

  get("/api/users/:id/posts", public_(
    async (c) => {
      const limit = Number(c.query.limit) || 20
      const offset = Number(c.query.offset) || 0

      const rows = await db.query(
        `select p.id, p.content, p.image_url, p.created_at,
          (select count(*) from likes where post_id = p.id) as like_count
         from posts p
         where p.user_id = $1
         order by p.created_at desc
         limit $2 offset $3`,
        [c.params.id, limit, offset],
      )

      return json(c, 200, rows)
    },
  )),
]
