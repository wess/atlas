import { get, put, post, del, json } from "@atlas/server"
import { db } from "../db.ts"
import { authed, public_ } from "../pipes/auth.ts"
import { notifyUser } from "../channels/notifications.ts"

export const userRoutes = [
  get("/api/users/:username", public_(
    async (c) => {
      const rows = await db.query(
        `select u.id, u.email, u.username, u.name, u.bio, u.avatar_url, u.created_at,
          (select count(*) from posts where user_id = u.id) as post_count,
          (select count(*) from follows where following_id = u.id) as follower_count,
          (select count(*) from follows where follower_id = u.id) as following_count
         from users u where u.username = $1`,
        [c.params.username],
      )

      return rows.length > 0
        ? json(c, 200, rows[0])
        : json(c, 404, { error: "User not found" })
    },
  )),

  put("/api/users/me", authed(
    async (c) => {
      const { name, bio, avatarUrl } = await c.req.json()
      const rows = await db.query(
        `update users set name = coalesce($1, name), bio = coalesce($2, bio), avatar_url = coalesce($3, avatar_url)
         where id = $4
         returning id, email, username, name, bio, avatar_url`,
        [name, bio, avatarUrl, c.auth.userId],
      )

      return rows.length > 0
        ? json(c, 200, rows[0])
        : json(c, 404, { error: "User not found" })
    },
  )),

  post("/api/users/:id/follow", authed(
    async (c) => {
      const targetId = Number(c.params.id)

      if (targetId === c.auth.userId) {
        return json(c, 400, { error: "Cannot follow yourself" })
      }

      const existing = await db.query(
        "select id from follows where follower_id = $1 and following_id = $2",
        [c.auth.userId, targetId],
      )

      if (existing.length > 0) {
        return json(c, 409, { error: "Already following this user" })
      }

      await db.query(
        "insert into follows (follower_id, following_id) values ($1, $2)",
        [c.auth.userId, targetId],
      )

      notifyUser(targetId, { type: "follow", fromUserId: c.auth.userId })

      return json(c, 201, { followed: true })
    },
  )),

  del("/api/users/:id/follow", authed(
    async (c) => {
      const targetId = Number(c.params.id)

      await db.query(
        "delete from follows where follower_id = $1 and following_id = $2",
        [c.auth.userId, targetId],
      )

      return json(c, 200, { unfollowed: true })
    },
  )),

  get("/api/users/:id/followers", public_(
    async (c) => {
      const rows = await db.query(
        `select u.id, u.username, u.name, u.avatar_url
         from follows f
         join users u on u.id = f.follower_id
         where f.following_id = $1
         order by f.created_at desc`,
        [c.params.id],
      )

      return json(c, 200, rows)
    },
  )),

  get("/api/users/:id/following", public_(
    async (c) => {
      const rows = await db.query(
        `select u.id, u.username, u.name, u.avatar_url
         from follows f
         join users u on u.id = f.following_id
         where f.follower_id = $1
         order by f.created_at desc`,
        [c.params.id],
      )

      return json(c, 200, rows)
    },
  )),
]
