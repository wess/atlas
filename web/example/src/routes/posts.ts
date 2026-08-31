import type { Connection } from "@atlas/db"
import { from } from "@atlas/db"
import { pipeline, parseJson, json, get, post, del } from "@atlas/server"
import { requireAuth } from "@atlas/auth"

export const postRoutes = (db: Connection, secret: string) => {
  const authed = pipeline(requireAuth({ secret }), parseJson)
  const guard = pipeline(requireAuth({ secret }))

  return [
    post("/posts", authed(async (c) => {
      const { content } = c.body as { content: string }
      if (!content || content.length > 280) {
        return json(c, 422, { error: "Content required, 280 chars max" })
      }

      const userId = (c.assigns.auth as any).id
      const rows = await db.execute(
        from("posts").insert({ userId, content }).returning("id", "content", "createdAt")
      )

      return json(c, 201, rows[0])
    })),

    get("/posts/:id", guard(async (c) => {
      const row = await db.one(
        from("posts").where(q => q("id").equals(Number(c.params.id)))
      )
      if (!row) return json(c, 404, { error: "Post not found" })
      return json(c, 200, row)
    })),

    del("/posts/:id", guard(async (c) => {
      const userId = (c.assigns.auth as any).id
      const row = await db.one(
        from("posts").where(q => q("id").equals(Number(c.params.id)))
      )
      if (!row) return json(c, 404, { error: "Post not found" })
      if (row.userId !== userId) return json(c, 403, { error: "Not your post" })

      await db.execute(
        from("posts").where(q => q("id").equals(Number(c.params.id))).del()
      )

      return json(c, 200, { deleted: true })
    })),
  ]
}
