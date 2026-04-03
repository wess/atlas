import { get, json } from "@atlas/server"
import { db } from "../db.ts"
import { apiKeyAuth } from "../pipes/apikey.ts"

type QueryParams = {
  status?: string
  limit?: string
  offset?: string
  sort?: string
  order?: string
}

const buildDeliveryQuery = (contentTypeId: number, query: QueryParams) => {
  const status = query.status || "published"
  const limit = Number(query.limit) || 10
  const offset = Number(query.offset) || 0
  const sort = query.sort || "published_at"
  const order = query.order === "asc" ? "asc" : "desc"

  const allowedSorts = ["published_at", "created_at", "updated_at", "slug"]
  const sortColumn = allowedSorts.includes(sort) ? sort : "published_at"

  const sql = `select e.id, e.slug, e.data, e.status, e.author_id,
    e.published_at, e.created_at, e.updated_at
    from entries e
    where e.content_type_id = $1 and e.status = $2
    order by e.${sortColumn} ${order}
    limit $3 offset $4`

  return { sql, params: [contentTypeId, status, limit, offset] }
}

const buildSingleQuery = (contentTypeId: number, slug: string) => {
  const sql = `select e.id, e.slug, e.data, e.status, e.author_id,
    e.published_at, e.created_at, e.updated_at
    from entries e
    where e.content_type_id = $1 and e.slug = $2 and e.status = 'published'`

  return { sql, params: [contentTypeId, slug] }
}

export const deliveryRoutes = [
  get("/api/content/:type", apiKeyAuth(
    async (c) => {
      const typeName = c.params.type

      const typeRows = await db.query(
        "select id, name, display_name, fields from content_types where name = $1",
        [typeName],
      )

      if (typeRows.length === 0) {
        return json(c, 404, { error: "Content type not found" })
      }

      const contentType = typeRows[0]
      const permissions = typeof c.apiKey.permissions === "string"
        ? JSON.parse(c.apiKey.permissions)
        : c.apiKey.permissions

      if (permissions.length > 0 && !permissions.includes(typeName)) {
        return json(c, 403, { error: "API key does not have access to this content type" })
      }

      const { sql, params } = buildDeliveryQuery(contentType.id, c.query)

      const rows = await db.query(sql, params)

      const includeAuthor = c.query.include === "author"
      let results = rows

      if (includeAuthor) {
        const authorIds = [...new Set(rows.map((r: { author_id: number }) => r.author_id))]

        if (authorIds.length > 0) {
          const placeholders = authorIds.map((_, i) => `$${i + 1}`).join(",")
          const authors = await db.query(
            `select id, name from users where id in (${placeholders})`,
            authorIds,
          )

          const authorMap = Object.fromEntries(
            authors.map((a: { id: number; name: string }) => [a.id, a]),
          )

          results = rows.map((r: { author_id: number }) => ({
            ...r,
            author: authorMap[r.author_id] || null,
          }))
        }
      }

      const fields = c.query.fields?.split(",").map((f: string) => f.trim())

      if (fields) {
        results = results.map((r: Record<string, unknown>) => {
          const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data
          const filtered = Object.fromEntries(
            Object.entries(data).filter(([key]) => fields.includes(key)),
          )
          return { ...r, data: filtered }
        })
      }

      return json(c, 200, {
        data: results,
        meta: { type: typeName, total: results.length },
      })
    },
  )),

  get("/api/content/:type/:slug", apiKeyAuth(
    async (c) => {
      const typeName = c.params.type
      const slug = c.params.slug

      const typeRows = await db.query(
        "select id, name from content_types where name = $1",
        [typeName],
      )

      if (typeRows.length === 0) {
        return json(c, 404, { error: "Content type not found" })
      }

      const contentType = typeRows[0]
      const permissions = typeof c.apiKey.permissions === "string"
        ? JSON.parse(c.apiKey.permissions)
        : c.apiKey.permissions

      if (permissions.length > 0 && !permissions.includes(typeName)) {
        return json(c, 403, { error: "API key does not have access to this content type" })
      }

      const { sql, params } = buildSingleQuery(contentType.id, slug)

      const rows = await db.query(sql, params)

      if (rows.length === 0) {
        return json(c, 404, { error: "Entry not found" })
      }

      const entry = rows[0]

      if (c.query.include === "author") {
        const authors = await db.query(
          "select id, name from users where id = $1",
          [entry.author_id],
        )
        entry.author = authors.length > 0 ? authors[0] : null
      }

      return json(c, 200, { data: entry })
    },
  )),

  get("/api/media/:id", apiKeyAuth(
    async (c) => {
      const rows = await db.query(
        "select id, filename, url, content_type, size, alt, created_at from media where id = $1",
        [c.params.id],
      )

      return rows.length > 0
        ? json(c, 200, { data: rows[0] })
        : json(c, 404, { error: "Media not found" })
    },
  )),
]
