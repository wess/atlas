import { from } from "@atlas/db"
import { del, get, json, pipe, post, put } from "@atlas/server"
import { notifyUser } from "../channels/notifications.ts"
import { db } from "../db.ts"
import { authed, currentUserId, guard } from "../pipes/auth.ts"
import { follows, users } from "../schema.ts"

export const userRoutes = [
  get(
    "/api/users/:username",
    pipe(async (c) => {
      const user = await db.one(
        from("users", "u")
          .select(
            "u.id",
            "u.email",
            "u.username",
            "u.name",
            "u.bio",
            "u.avatarUrl",
            "u.createdAt",
            "(select count(*) from posts where posts.userId = u.id) as postCount",
            "(select count(*) from follows where follows.followingId = u.id) as followerCount",
            "(select count(*) from follows where follows.followerId = u.id) as followingCount",
          )
          .where((q) => q("u.username").equals(c.params.username)),
      )

      return user ? json(c, 200, user) : json(c, 404, { error: "User not found" })
    }),
  ),

  put(
    "/api/users/me",
    authed(async (c) => {
      const { name, bio, avatarUrl } = (c.body ?? {}) as { name?: string; bio?: string; avatarUrl?: string }

      const changes = {
        ...(name === undefined ? {} : { name }),
        ...(bio === undefined ? {} : { bio }),
        ...(avatarUrl === undefined ? {} : { avatarUrl }),
      }
      if (Object.keys(changes).length === 0) return json(c, 400, { error: "Nothing to update" })

      const rows = await db.execute(
        from(users)
          .update(changes)
          .where((q) => q("id").equals(currentUserId(c)))
          .returning("id", "email", "username", "name", "bio", "avatarUrl"),
      )
      const user = rows[0]

      return user ? json(c, 200, user) : json(c, 404, { error: "User not found" })
    }),
  ),

  post(
    "/api/users/:id/follow",
    guard(async (c) => {
      const userId = currentUserId(c)
      const targetId = Number(c.params.id)

      if (targetId === userId) return json(c, 400, { error: "Cannot follow yourself" })

      const target = await db.one(
        from(users)
          .select("id")
          .where((q) => q("id").equals(targetId)),
      )
      if (!target) return json(c, 404, { error: "User not found" })

      const existing = await db.one(
        from(follows)
          .select("id")
          .where((q) => q("followerId").equals(userId))
          .where((q) => q("followingId").equals(targetId)),
      )
      if (existing) return json(c, 409, { error: "Already following this user" })

      await db.execute(from(follows).insert({ followerId: userId, followingId: targetId }))
      notifyUser(targetId, { type: "follow", fromUserId: userId })

      return json(c, 201, { followed: true })
    }),
  ),

  del(
    "/api/users/:id/follow",
    guard(async (c) => {
      await db.execute(
        from(follows)
          .where((q) => q("followerId").equals(currentUserId(c)))
          .where((q) => q("followingId").equals(Number(c.params.id)))
          .del(),
      )

      return json(c, 200, { unfollowed: true })
    }),
  ),

  get(
    "/api/users/:id/followers",
    pipe(async (c) => {
      const rows = await db.all(
        from("follows", "f")
          .join("users", "u.id = f.followerId", "u")
          .select("u.id", "u.username", "u.name", "u.avatarUrl")
          .where((q) => q("f.followingId").equals(Number(c.params.id)))
          .orderBy("f.createdAt", "DESC"),
      )

      return json(c, 200, rows)
    }),
  ),

  get(
    "/api/users/:id/following",
    pipe(async (c) => {
      const rows = await db.all(
        from("follows", "f")
          .join("users", "u.id = f.followingId", "u")
          .select("u.id", "u.username", "u.name", "u.avatarUrl")
          .where((q) => q("f.followerId").equals(Number(c.params.id)))
          .orderBy("f.createdAt", "DESC"),
      )

      return json(c, 200, rows)
    }),
  ),
]
