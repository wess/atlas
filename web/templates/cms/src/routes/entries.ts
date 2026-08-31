import { from } from "@atlas/db"
import { del, get, json, post, put } from "@atlas/server"
import { db } from "../db.ts"
import { dispatchWebhooks } from "../dispatch/index.ts"
import { authed, claims, guard } from "../pipes/auth.ts"
import { contentTypes, entries, revisions } from "../schema.ts"

const entryColumns = [
  "id",
  "contentTypeId",
  "slug",
  "data",
  "status",
  "authorId",
  "publishedAt",
  "createdAt",
  "updatedAt",
] as const

const entryDetails = (...extra: string[]) =>
  from("entries", "e")
    .join("users", "u.id = e.authorId", "u")
    .join("content_types", "ct.id = e.contentTypeId", "ct")
    .select(
      "e.id",
      "e.contentTypeId",
      "e.slug",
      "e.data",
      "e.status",
      "e.authorId",
      "e.publishedAt",
      "e.createdAt",
      "e.updatedAt",
      "u.name as authorName",
      "ct.displayName as typeName",
      ...extra,
    )

export const entryRoutes = [
  get(
    "/admin/api/entries",
    guard(async (c) => {
      const limit = Number(c.query.limit) || 20
      const offset = Number(c.query.offset) || 0

      const base = entryDetails()
      const byType = c.query.type ? base.where((q) => q("e.contentTypeId").equals(Number(c.query.type))) : base
      const byStatus = c.query.status ? byType.where((q) => q("e.status").equals(c.query.status)) : byType

      const rows = await db.all(byStatus.orderBy("e.updatedAt", "DESC").limit(limit).offset(offset))

      return json(c, 200, rows)
    }),
  ),

  get(
    "/admin/api/entries/:id",
    guard(async (c) => {
      const row = await db.one(
        entryDetails("ct.fields as typeFields").where((q) => q("e.id").equals(Number(c.params.id))),
      )

      return row ? json(c, 200, row) : json(c, 404, { error: "Entry not found" })
    }),
  ),

  post(
    "/admin/api/entries",
    authed(async (c) => {
      if (claims(c).role === "viewer") return json(c, 403, { error: "Viewers cannot create entries" })

      const { contentTypeId, slug, data } = (c.body ?? {}) as {
        contentTypeId?: number
        slug?: string
        data?: unknown
      }
      if (!contentTypeId || !slug || !data) {
        return json(c, 400, { error: "contentTypeId, slug, and data are required" })
      }

      const type = await db.one(
        from(contentTypes)
          .select("id")
          .where((q) => q("id").equals(contentTypeId)),
      )
      if (!type) return json(c, 404, { error: "Content type not found" })

      const existing = await db.one(
        from(entries)
          .select("id")
          .where((q) => q("contentTypeId").equals(contentTypeId))
          .where((q) => q("slug").equals(slug)),
      )
      if (existing) return json(c, 409, { error: "Slug already exists for this content type" })

      const rows = await db.execute(
        from(entries)
          .insert({
            contentTypeId,
            slug,
            data: JSON.stringify(data),
            status: "draft",
            authorId: claims(c).userId,
          })
          .returning(...entryColumns),
      )
      const entry = rows[0]
      if (!entry) return json(c, 500, { error: "Create failed" })

      await db.execute(
        from(revisions).insert({ entryId: entry.id, data: JSON.stringify(data), authorId: claims(c).userId }),
      )

      return json(c, 201, entry)
    }),
  ),

  put(
    "/admin/api/entries/:id",
    authed(async (c) => {
      if (claims(c).role === "viewer") return json(c, 403, { error: "Viewers cannot update entries" })

      const id = Number(c.params.id)
      const { slug, data } = (c.body ?? {}) as { slug?: string; data?: unknown }

      const existing = await db.one(
        from(entries)
          .select("id", "contentTypeId")
          .where((q) => q("id").equals(id)),
      )
      if (!existing) return json(c, 404, { error: "Entry not found" })

      if (slug) {
        const clash = await db.one(
          from(entries)
            .select("id")
            .where((q) => q("contentTypeId").equals(existing.contentTypeId))
            .where((q) => q("slug").equals(slug))
            .where((q) => q("id").notEquals(id)),
        )
        if (clash) return json(c, 409, { error: "Slug already exists for this content type" })
      }

      const changes = {
        ...(slug === undefined ? {} : { slug }),
        ...(data === undefined ? {} : { data: JSON.stringify(data) }),
        updatedAt: new Date().toISOString(),
      }

      const rows = await db.execute(
        from(entries)
          .update(changes)
          .where((q) => q("id").equals(id))
          .returning(...entryColumns),
      )
      const entry = rows[0]
      if (!entry) return json(c, 500, { error: "Update failed" })

      if (data !== undefined) {
        await db.execute(
          from(revisions).insert({ entryId: id, data: JSON.stringify(data), authorId: claims(c).userId }),
        )
      }

      return json(c, 200, entry)
    }),
  ),

  del(
    "/admin/api/entries/:id",
    guard(async (c) => {
      const { role, userId } = claims(c)
      if (role === "viewer") return json(c, 403, { error: "Viewers cannot delete entries" })

      const id = Number(c.params.id)
      const existing = await db.one(
        from(entries)
          .select("id", "authorId")
          .where((q) => q("id").equals(id)),
      )
      if (!existing) return json(c, 404, { error: "Entry not found" })
      if (role === "editor" && existing.authorId !== userId) {
        return json(c, 403, { error: "Editors can only delete their own entries" })
      }

      await db.execute(
        from(revisions)
          .where((q) => q("entryId").equals(id))
          .del(),
      )
      await db.execute(
        from(entries)
          .where((q) => q("id").equals(id))
          .del(),
      )

      return json(c, 200, { deleted: true })
    }),
  ),

  post(
    "/admin/api/entries/:id/publish",
    guard(async (c) => {
      if (claims(c).role === "viewer") return json(c, 403, { error: "Viewers cannot publish entries" })

      const id = Number(c.params.id)
      const existing = await db.one(
        from(entries)
          .select("id", "status")
          .where((q) => q("id").equals(id)),
      )
      if (!existing) return json(c, 404, { error: "Entry not found" })
      if (existing.status === "published") return json(c, 409, { error: "Entry is already published" })

      const now = new Date().toISOString()
      const rows = await db.execute(
        from(entries)
          .update({ status: "published", publishedAt: now, updatedAt: now })
          .where((q) => q("id").equals(id))
          .returning(...entryColumns),
      )
      const entry = rows[0]
      if (!entry) return json(c, 500, { error: "Publish failed" })

      await dispatchWebhooks("entry.published", entry)

      return json(c, 200, entry)
    }),
  ),

  post(
    "/admin/api/entries/:id/unpublish",
    guard(async (c) => {
      if (claims(c).role === "viewer") return json(c, 403, { error: "Viewers cannot unpublish entries" })

      const id = Number(c.params.id)
      const existing = await db.one(
        from(entries)
          .select("id", "status")
          .where((q) => q("id").equals(id)),
      )
      if (!existing) return json(c, 404, { error: "Entry not found" })
      if (existing.status !== "published") return json(c, 409, { error: "Entry is not published" })

      const rows = await db.execute(
        from(entries)
          .update({ status: "draft", publishedAt: null, updatedAt: new Date().toISOString() })
          .where((q) => q("id").equals(id))
          .returning(...entryColumns),
      )
      const entry = rows[0]
      if (!entry) return json(c, 500, { error: "Unpublish failed" })

      await dispatchWebhooks("entry.unpublished", entry)

      return json(c, 200, entry)
    }),
  ),
]
