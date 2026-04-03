import { get, post, put, del, json } from "@atlas/server"
import { db } from "../db.ts"
import { authed } from "../pipes/auth.ts"

export const typeRoutes = [
  get("/admin/api/types", authed(
    async (c) => {
      const rows = await db.query(
        "select id, name, display_name, fields, created_at, updated_at from content_types order by name",
      )

      return json(c, 200, rows)
    },
  )),

  get("/admin/api/types/:id", authed(
    async (c) => {
      const rows = await db.query(
        "select id, name, display_name, fields, created_at, updated_at from content_types where id = $1",
        [c.params.id],
      )

      return rows.length > 0
        ? json(c, 200, rows[0])
        : json(c, 404, { error: "Content type not found" })
    },
  )),

  post("/admin/api/types", authed(
    async (c) => {
      if (c.auth.role === "viewer") {
        return json(c, 403, { error: "Viewers cannot create content types" })
      }

      const { name, displayName, fields } = await c.req.json()

      if (!name || !displayName || !fields) {
        return json(c, 400, { error: "name, displayName, and fields are required" })
      }

      const existing = await db.query(
        "select id from content_types where name = $1",
        [name],
      )

      if (existing.length > 0) {
        return json(c, 409, { error: "Content type name already exists" })
      }

      const rows = await db.query(
        `insert into content_types (name, display_name, fields)
         values ($1, $2, $3)
         returning id, name, display_name, fields, created_at, updated_at`,
        [name, displayName, JSON.stringify(fields)],
      )

      return json(c, 201, rows[0])
    },
  )),

  put("/admin/api/types/:id", authed(
    async (c) => {
      if (c.auth.role === "viewer") {
        return json(c, 403, { error: "Viewers cannot update content types" })
      }

      const { displayName, fields } = await c.req.json()

      const existing = await db.query(
        "select id from content_types where id = $1",
        [c.params.id],
      )

      if (existing.length === 0) {
        return json(c, 404, { error: "Content type not found" })
      }

      const rows = await db.query(
        `update content_types
         set display_name = coalesce($1, display_name),
             fields = coalesce($2, fields),
             updated_at = datetime('now')
         where id = $3
         returning id, name, display_name, fields, created_at, updated_at`,
        [displayName || null, fields ? JSON.stringify(fields) : null, c.params.id],
      )

      return json(c, 200, rows[0])
    },
  )),

  del("/admin/api/types/:id", authed(
    async (c) => {
      if (c.auth.role !== "admin") {
        return json(c, 403, { error: "Only admins can delete content types" })
      }

      const existing = await db.query(
        "select id from content_types where id = $1",
        [c.params.id],
      )

      if (existing.length === 0) {
        return json(c, 404, { error: "Content type not found" })
      }

      const entryCount = await db.query(
        "select count(*) as count from entries where content_type_id = $1",
        [c.params.id],
      )

      if (entryCount[0].count > 0) {
        return json(c, 409, { error: "Cannot delete content type with existing entries" })
      }

      await db.query("delete from content_types where id = $1", [c.params.id])

      return json(c, 200, { deleted: true })
    },
  )),
]
