import type { Connection } from "@atlas/db"
import { from } from "@atlas/db"
import { pipeline, json, post, del, get } from "@atlas/server"
import { requireAuth } from "@atlas/auth"

export const socialRoutes = (db: Connection, secret: string) => {
  const guard = pipeline(requireAuth({ secret }))

  return [
    post("/follow/:userId", guard(async (c) => {
      const followerId = (c.assigns.auth as any).id
      const followingId = Number(c.params.userId)

      if (followerId === followingId) {
        return json(c, 422, { error: "Cannot follow yourself" })
      }

      await db.execute(
        from("follows").insert({ followerId, followingId })
      )

      return json(c, 201, { following: followingId })
    })),

    del("/follow/:userId", guard(async (c) => {
      const followerId = (c.assigns.auth as any).id
      const followingId = Number(c.params.userId)

      await db.execute(
        from("follows")
          .where(q => q("followerId").equals(followerId))
          .where(q => q("followingId").equals(followingId))
          .del()
      )

      return json(c, 200, { unfollowed: followingId })
    })),

    post("/posts/:id/like", guard(async (c) => {
      const userId = (c.assigns.auth as any).id
      const postId = Number(c.params.id)

      await db.execute(
        from("likes").insert({ userId, postId })
      )

      return json(c, 201, { liked: postId })
    })),

    del("/posts/:id/like", guard(async (c) => {
      const userId = (c.assigns.auth as any).id
      const postId = Number(c.params.id)

      await db.execute(
        from("likes")
          .where(q => q("userId").equals(userId))
          .where(q => q("postId").equals(postId))
          .del()
      )

      return json(c, 200, { unliked: postId })
    })),

    get("/users/:handle", guard(async (c) => {
      const user = await db.one(
        from("users")
          .where(q => q("handle").equals(c.params.handle))
          .select("id", "handle", "bio", "createdAt")
      )
      if (!user) return json(c, 404, { error: "User not found" })

      return json(c, 200, user)
    })),
  ]
}
