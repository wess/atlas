import { from } from "@atlas/db"
import { del, get, json, pipe, post } from "@atlas/server"
import { notifyUser } from "../channels/notifications.ts"
import { db } from "../db.ts"
import { authed, currentUserId, guard } from "../pipes/auth.ts"
import { likes, posts } from "../schema.ts"

export const postRoutes = [
  post(
    "/api/posts",
    authed(async (c) => {
      const { content, imageUrl } = (c.body ?? {}) as { content?: string; imageUrl?: string }

      if (!content) return json(c, 400, { error: "content is required" })

      const rows = await db.execute(
        from(posts)
          .insert({ userId: currentUserId(c), content, imageUrl: imageUrl ?? null })
          .returning("id", "userId", "content", "imageUrl", "createdAt"),
      )

      return json(c, 201, rows[0])
    }),
  ),

  get(
    "/api/posts/:id",
    pipe(async (c) => {
      const row = await db.one(
        from("posts", "p")
          .join("users", "u.id = p.userId", "u")
          .select(
            "p.id",
            "p.userId",
            "p.content",
            "p.imageUrl",
            "p.createdAt",
            "u.username",
            "u.name",
            "u.avatarUrl",
            "(select count(*) from likes where likes.postId = p.id) as likeCount",
          )
          .where((q) => q("p.id").equals(Number(c.params.id))),
      )

      return row ? json(c, 200, row) : json(c, 404, { error: "Post not found" })
    }),
  ),

  del(
    "/api/posts/:id",
    guard(async (c) => {
      const postId = Number(c.params.id)

      const row = await db.one(
        from(posts)
          .select("id", "userId")
          .where((q) => q("id").equals(postId)),
      )
      if (!row) return json(c, 404, { error: "Post not found" })
      if (row.userId !== currentUserId(c)) return json(c, 403, { error: "Not authorized to delete this post" })

      await db.execute(
        from(likes)
          .where((q) => q("postId").equals(postId))
          .del(),
      )
      await db.execute(
        from(posts)
          .where((q) => q("id").equals(postId))
          .del(),
      )

      return json(c, 200, { deleted: true })
    }),
  ),

  post(
    "/api/posts/:id/like",
    guard(async (c) => {
      const userId = currentUserId(c)
      const postId = Number(c.params.id)

      const row = await db.one(
        from(posts)
          .select("id", "userId")
          .where((q) => q("id").equals(postId)),
      )
      if (!row) return json(c, 404, { error: "Post not found" })

      const existing = await db.one(
        from(likes)
          .select("id")
          .where((q) => q("userId").equals(userId))
          .where((q) => q("postId").equals(postId)),
      )
      if (existing) return json(c, 409, { error: "Already liked this post" })

      await db.execute(from(likes).insert({ userId, postId }))
      if (row.userId !== userId) notifyUser(row.userId, { type: "like", postId, fromUserId: userId })

      return json(c, 201, { liked: true })
    }),
  ),

  del(
    "/api/posts/:id/like",
    guard(async (c) => {
      await db.execute(
        from(likes)
          .where((q) => q("userId").equals(currentUserId(c)))
          .where((q) => q("postId").equals(Number(c.params.id)))
          .del(),
      )

      return json(c, 200, { unliked: true })
    }),
  ),

  get(
    "/api/users/:id/posts",
    pipe(async (c) => {
      const limit = Number(c.query.limit) || 20
      const offset = Number(c.query.offset) || 0

      const rows = await db.all(
        from("posts", "p")
          .select(
            "p.id",
            "p.content",
            "p.imageUrl",
            "p.createdAt",
            "(select count(*) from likes where likes.postId = p.id) as likeCount",
          )
          .where((q) => q("p.userId").equals(Number(c.params.id)))
          .orderBy("p.createdAt", "DESC")
          .limit(limit)
          .offset(offset),
      )

      return json(c, 200, rows)
    }),
  ),
]
