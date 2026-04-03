import { get, post, json } from "@atlas/server"
import { db } from "../db.ts"
import { authed } from "../pipes/auth.ts"

export const revisionRoutes = [
  get("/admin/api/entries/:id/revisions", authed(
    async (c) => {
      const entryRows = await db.query(
        "select id from entries where id = $1",
        [c.params.id],
      )

      if (entryRows.length === 0) {
        return json(c, 404, { error: "Entry not found" })
      }

      const rows = await db.query(
        `select r.id, r.entry_id, r.data, r.author_id, r.created_at,
          u.name as author_name
         from revisions r
         join users u on u.id = r.author_id
         where r.entry_id = $1
         order by r.created_at desc`,
        [c.params.id],
      )

      return json(c, 200, rows)
    },
  )),

  post("/admin/api/entries/:id/revisions/:revId/restore", authed(
    async (c) => {
      if (c.auth.role === "viewer") {
        return json(c, 403, { error: "Viewers cannot restore revisions" })
      }

      const revRows = await db.query(
        "select id, entry_id, data from revisions where id = $1 and entry_id = $2",
        [c.params.revId, c.params.id],
      )

      if (revRows.length === 0) {
        return json(c, 404, { error: "Revision not found" })
      }

      const revision = revRows[0]

      const rows = await db.query(
        `update entries
         set data = $1, updated_at = datetime('now')
         where id = $2
         returning id, content_type_id, slug, data, status, author_id, published_at, created_at, updated_at`,
        [revision.data, c.params.id],
      )

      await db.query(
        `insert into revisions (entry_id, data, author_id)
         values ($1, $2, $3)`,
        [c.params.id, revision.data, c.auth.userId],
      )

      return json(c, 200, rows[0])
    },
  )),
]
