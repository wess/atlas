import { from } from "@atlas/db"
import { get, halt, json, options, pipeline } from "@atlas/server"
import { db } from "../db.ts"
import { apiKeyAuth, keyPermissions } from "../pipes/apikey.ts"
import { cors } from "../pipes/cors.ts"
import { contentTypes, media, users } from "../schema.ts"

const sortColumns = ["publishedAt", "createdAt", "updatedAt", "slug"]

const entryColumns = [
  "e.id",
  "e.slug",
  "e.data",
  "e.status",
  "e.authorId",
  "e.publishedAt",
  "e.createdAt",
  "e.updatedAt",
] as const

const publishedEntries = (contentTypeId: number, query: Record<string, string>) => {
  const limit = Number(query.limit) || 10
  const offset = Number(query.offset) || 0
  const sort = query.sort && sortColumns.includes(query.sort) ? query.sort : "publishedAt"
  const order = query.order === "asc" ? ("ASC" as const) : ("DESC" as const)
  const status = query.status || "published"

  return from("entries", "e")
    .select(...entryColumns)
    .where((q) => q("e.contentTypeId").equals(contentTypeId))
    .where((q) => q("e.status").equals(status))
    .orderBy(`e.${sort}`, order)
    .limit(limit)
    .offset(offset)
}

const attachAuthors = async (rows: any[]): Promise<any[]> => {
  const authorIds = [...new Set(rows.map((r) => r.authorId))]
  if (authorIds.length === 0) return rows

  const authors = await db.all(
    from(users)
      .select("id", "name")
      .where((q) => q("id").inList(authorIds)),
  )
  const byId = new Map(authors.map((a) => [a.id, a]))

  return rows.map((r) => ({ ...r, author: byId.get(r.authorId) ?? null }))
}

const applySparseFields = (rows: any[], fields: string | undefined): any[] => {
  if (!fields) return rows

  const wanted = fields
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean)

  return rows.map((r) => {
    const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data
    const filtered = Object.fromEntries(Object.entries(data ?? {}).filter(([key]) => wanted.includes(key)))
    return { ...r, data: filtered }
  })
}

export const deliveryRoutes = [
  get(
    "/api/content/:type",
    apiKeyAuth(async (c) => {
      const typeName = c.params.type ?? ""

      const contentType = await db.one(
        from(contentTypes)
          .select("id", "name", "displayName", "fields")
          .where((q) => q("name").equals(typeName)),
      )
      if (!contentType) return json(c, 404, { error: "Content type not found" })

      const permissions = keyPermissions(c)
      if (permissions.length > 0 && !permissions.includes(typeName)) {
        return json(c, 403, { error: "API key does not have access to this content type" })
      }

      const rows = await db.all(publishedEntries(contentType.id, c.query))
      const withAuthors = c.query.include === "author" ? await attachAuthors(rows) : rows
      const results = applySparseFields(withAuthors, c.query.fields)

      return json(c, 200, { data: results, meta: { type: typeName, total: results.length } })
    }),
  ),

  get(
    "/api/content/:type/:slug",
    apiKeyAuth(async (c) => {
      const typeName = c.params.type ?? ""

      const contentType = await db.one(
        from(contentTypes)
          .select("id")
          .where((q) => q("name").equals(typeName)),
      )
      if (!contentType) return json(c, 404, { error: "Content type not found" })

      const permissions = keyPermissions(c)
      if (permissions.length > 0 && !permissions.includes(typeName)) {
        return json(c, 403, { error: "API key does not have access to this content type" })
      }

      const entry = await db.one<any>(
        from("entries", "e")
          .select(...entryColumns)
          .where((q) => q("e.contentTypeId").equals(contentType.id))
          .where((q) => q("e.slug").equals(c.params.slug))
          .where((q) => q("e.status").equals("published")),
      )
      if (!entry) return json(c, 404, { error: "Entry not found" })

      if (c.query.include !== "author") return json(c, 200, { data: entry })

      const author = await db.one(
        from(users)
          .select("id", "name")
          .where((q) => q("id").equals(entry.authorId)),
      )

      return json(c, 200, { data: { ...entry, author } })
    }),
  ),

  get(
    "/api/media/:id",
    apiKeyAuth(async (c) => {
      const row = await db.one(
        from(media)
          .select("id", "filename", "url", "contentType", "size", "alt", "createdAt")
          .where((q) => q("id").equals(Number(c.params.id))),
      )

      return row ? json(c, 200, { data: row }) : json(c, 404, { error: "Media not found" })
    }),
  ),

  options(
    "/api/*",
    pipeline(cors)((c) => halt(c, 204)),
  ),
]
