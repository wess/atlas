import { from, raw } from "@atlas/db"
import { get, json } from "@atlas/server"
import { db } from "../db.ts"
import { currentUserId, guard } from "../pipes/auth.ts"
import { likes } from "../schema.ts"

export const feedRoutes = [
  get(
    "/api/feed",
    guard(async (c) => {
      const userId = currentUserId(c)
      const limit = Number(c.query.limit) || 20
      const offset = Number(c.query.offset) || 0

      const rows = await db.all<any>(
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
          .where((q) => q.raw(raw("p.userId in (select followingId from follows where followerId = $1)", userId)))
          .orderBy("p.createdAt", "DESC")
          .limit(limit)
          .offset(offset),
      )

      const liked = await db.all(
        from(likes)
          .select("postId")
          .where((q) => q("userId").equals(userId)),
      )
      const likedIds = new Set(liked.map((row) => row.postId))

      return json(
        c,
        200,
        rows.map((row) => ({ ...row, likedByMe: likedIds.has(row.id) })),
      )
    }),
  ),
]
