import type { Connection } from "@wess/atlas/db/query";
import { from, raw } from "@wess/atlas/db/query";
import { pipeline, json, get } from "@wess/atlas/server"
import { requireAuth } from "@wess/atlas/auth/flows";

export const timelineRoutes = (db: Connection, secret: string) => {
  const guard = pipeline(requireAuth({ secret }))

  return [
    get("/timeline", guard(async (c) => {
      const userId = (c.assigns.auth as any).id

      const rows = await db.all(
        from("posts")
          .join("follows", raw("follows.followingId = posts.userId"))
          .where(q => q("follows.followerId").equals(userId))
          .select("posts.id", "posts.content", "posts.userId", "posts.createdAt")
          .orderBy("posts.createdAt", "DESC")
          .limit(50)
      )

      return json(c, 200, rows)
    })),

    get("/users/:handle/posts", guard(async (c) => {
      const user = await db.one(
        from("users").where(q => q("handle").equals(c.params.handle)).select("id")
      )
      if (!user) return json(c, 404, { error: "User not found" })

      const rows = await db.all(
        from("posts")
          .where(q => q("userId").equals(user.id))
          .orderBy("createdAt", "DESC")
          .limit(50)
      )

      return json(c, 200, rows)
    })),
  ]
}
