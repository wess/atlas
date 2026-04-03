import { get, post, put, del, json } from "@atlas/server"
import { db } from "../db.ts"
import { authed } from "../pipes/auth.ts"
import { dispatchWebhooks } from "../dispatch/index.ts"

export const entryRoutes = [
  get("/admin/api/entries", authed(
    async (c) => {
      const limit = Number(c.query.limit) || 20
      const offset = Number(c.query.offset) || 0
      const typeId = c.query.type
      const status = c.query.status

      let sql = `select e.id, e.content_type_id, e.slug, e.data, e.status,
        e.author_id, e.published_at, e.created_at, e.updated_at,
        u.name as author_name, ct.display_name as type_name
        from entries e
        join users u on u.id = e.author_id
        join content_types ct on ct.id = e.content_type_id
        where 1=1`
      const params: unknown[] = []
      let paramIdx = 1

      if (typeId) {
        sql += ` and e.content_type_id = $${paramIdx++}`
        params.push(typeId)
      }

      if (status) {
        sql += ` and e.status = $${paramIdx++}`
        params.push(status)
      }

      sql += ` order by e.updated_at desc limit $${paramIdx++} offset $${paramIdx++}`
      params.push(limit, offset)

      const rows = await db.query(sql, params)

      return json(c, 200, rows)
    },
  )),

  get("/admin/api/entries/:id", authed(
    async (c) => {
      const rows = await db.query(
        `select e.id, e.content_type_id, e.slug, e.data, e.status,
          e.author_id, e.published_at, e.created_at, e.updated_at,
          u.name as author_name, ct.display_name as type_name, ct.fields as type_fields
         from entries e
         join users u on u.id = e.author_id
         join content_types ct on ct.id = e.content_type_id
         where e.id = $1`,
        [c.params.id],
      )

      return rows.length > 0
        ? json(c, 200, rows[0])
        : json(c, 404, { error: "Entry not found" })
    },
  )),

  post("/admin/api/entries", authed(
    async (c) => {
      if (c.auth.role === "viewer") {
        return json(c, 403, { error: "Viewers cannot create entries" })
      }

      const { contentTypeId, slug, data } = await c.req.json()

      if (!contentTypeId || !slug || !data) {
        return json(c, 400, { error: "contentTypeId, slug, and data are required" })
      }

      const typeRows = await db.query(
        "select id from content_types where id = $1",
        [contentTypeId],
      )

      if (typeRows.length === 0) {
        return json(c, 404, { error: "Content type not found" })
      }

      const existing = await db.query(
        "select id from entries where content_type_id = $1 and slug = $2",
        [contentTypeId, slug],
      )

      if (existing.length > 0) {
        return json(c, 409, { error: "Slug already exists for this content type" })
      }

      const rows = await db.query(
        `insert into entries (content_type_id, slug, data, status, author_id)
         values ($1, $2, $3, 'draft', $4)
         returning id, content_type_id, slug, data, status, author_id, published_at, created_at, updated_at`,
        [contentTypeId, slug, JSON.stringify(data), c.auth.userId],
      )

      const entry = rows[0]

      await db.query(
        `insert into revisions (entry_id, data, author_id)
         values ($1, $2, $3)`,
        [entry.id, JSON.stringify(data), c.auth.userId],
      )

      return json(c, 201, entry)
    },
  )),

  put("/admin/api/entries/:id", authed(
    async (c) => {
      if (c.auth.role === "viewer") {
        return json(c, 403, { error: "Viewers cannot update entries" })
      }

      const { slug, data } = await c.req.json()

      const existing = await db.query(
        "select id, content_type_id from entries where id = $1",
        [c.params.id],
      )

      if (existing.length === 0) {
        return json(c, 404, { error: "Entry not found" })
      }

      if (slug) {
        const slugCheck = await db.query(
          "select id from entries where content_type_id = $1 and slug = $2 and id != $3",
          [existing[0].content_type_id, slug, c.params.id],
        )

        if (slugCheck.length > 0) {
          return json(c, 409, { error: "Slug already exists for this content type" })
        }
      }

      const rows = await db.query(
        `update entries
         set slug = coalesce($1, slug),
             data = coalesce($2, data),
             updated_at = datetime('now')
         where id = $3
         returning id, content_type_id, slug, data, status, author_id, published_at, created_at, updated_at`,
        [slug || null, data ? JSON.stringify(data) : null, c.params.id],
      )

      const entry = rows[0]

      if (data) {
        await db.query(
          `insert into revisions (entry_id, data, author_id)
           values ($1, $2, $3)`,
          [entry.id, JSON.stringify(data), c.auth.userId],
        )
      }

      return json(c, 200, entry)
    },
  )),

  del("/admin/api/entries/:id", authed(
    async (c) => {
      if (c.auth.role === "viewer") {
        return json(c, 403, { error: "Viewers cannot delete entries" })
      }

      const existing = await db.query(
        "select id, author_id from entries where id = $1",
        [c.params.id],
      )

      if (existing.length === 0) {
        return json(c, 404, { error: "Entry not found" })
      }

      if (c.auth.role === "editor" && existing[0].author_id !== c.auth.userId) {
        return json(c, 403, { error: "Editors can only delete their own entries" })
      }

      await db.query("delete from revisions where entry_id = $1", [c.params.id])
      await db.query("delete from entries where id = $1", [c.params.id])

      return json(c, 200, { deleted: true })
    },
  )),

  post("/admin/api/entries/:id/publish", authed(
    async (c) => {
      if (c.auth.role === "viewer") {
        return json(c, 403, { error: "Viewers cannot publish entries" })
      }

      const existing = await db.query(
        "select id, status, data, content_type_id, slug from entries where id = $1",
        [c.params.id],
      )

      if (existing.length === 0) {
        return json(c, 404, { error: "Entry not found" })
      }

      if (existing[0].status === "published") {
        return json(c, 409, { error: "Entry is already published" })
      }

      const rows = await db.query(
        `update entries
         set status = 'published', published_at = datetime('now'), updated_at = datetime('now')
         where id = $1
         returning id, content_type_id, slug, data, status, author_id, published_at, created_at, updated_at`,
        [c.params.id],
      )

      const entry = rows[0]

      dispatchWebhooks("entry.published", entry)

      return json(c, 200, entry)
    },
  )),

  post("/admin/api/entries/:id/unpublish", authed(
    async (c) => {
      if (c.auth.role === "viewer") {
        return json(c, 403, { error: "Viewers cannot unpublish entries" })
      }

      const existing = await db.query(
        "select id, status from entries where id = $1",
        [c.params.id],
      )

      if (existing.length === 0) {
        return json(c, 404, { error: "Entry not found" })
      }

      if (existing[0].status !== "published") {
        return json(c, 409, { error: "Entry is not published" })
      }

      const rows = await db.query(
        `update entries
         set status = 'draft', published_at = null, updated_at = datetime('now')
         where id = $1
         returning id, content_type_id, slug, data, status, author_id, published_at, created_at, updated_at`,
        [c.params.id],
      )

      const entry = rows[0]

      dispatchWebhooks("entry.unpublished", entry)

      return json(c, 200, entry)
    },
  )),
]
