import { from } from "@atlas/db"
import { get, json, post } from "@atlas/server"
import { db } from "../db.ts"
import { claims, guard } from "../pipes/auth.ts"
import { entries, revisions } from "../schema.ts"

export const revisionRoutes = [
  get(
    "/admin/api/entries/:id/revisions",
    guard(async (c) => {
      const id = Number(c.params.id)

      const entry = await db.one(
        from(entries)
          .select("id")
          .where((q) => q("id").equals(id)),
      )
      if (!entry) return json(c, 404, { error: "Entry not found" })

      const rows = await db.all(
        from("revisions", "r")
          .join("users", "u.id = r.authorId", "u")
          .select("r.id", "r.entryId", "r.data", "r.authorId", "r.createdAt", "u.name as authorName")
          .where((q) => q("r.entryId").equals(id))
          .orderBy("r.createdAt", "DESC"),
      )

      return json(c, 200, rows)
    }),
  ),

  post(
    "/admin/api/entries/:id/revisions/:revId/restore",
    guard(async (c) => {
      if (claims(c).role === "viewer") return json(c, 403, { error: "Viewers cannot restore revisions" })

      const entryId = Number(c.params.id)
      const revId = Number(c.params.revId)

      const revision = await db.one(
        from(revisions)
          .where((q) => q("id").equals(revId))
          .where((q) => q("entryId").equals(entryId)),
      )
      if (!revision) return json(c, 404, { error: "Revision not found" })

      const rows = await db.execute(
        from(entries)
          .update({ data: revision.data, updatedAt: new Date().toISOString() })
          .where((q) => q("id").equals(entryId))
          .returning(
            "id",
            "contentTypeId",
            "slug",
            "data",
            "status",
            "authorId",
            "publishedAt",
            "createdAt",
            "updatedAt",
          ),
      )

      await db.execute(from(revisions).insert({ entryId, data: revision.data, authorId: claims(c).userId }))

      return json(c, 200, rows[0])
    }),
  ),
]
