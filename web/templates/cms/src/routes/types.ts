import { from } from "@atlas/db"
import { del, get, json, post, put } from "@atlas/server"
import { db } from "../db.ts"
import { authed, claims, guard } from "../pipes/auth.ts"
import { contentTypes, entries } from "../schema.ts"

export const typeRoutes = [
  get(
    "/admin/api/types",
    guard(async (c) => {
      const rows = await db.all(from(contentTypes).orderBy("name", "ASC"))
      return json(c, 200, rows)
    }),
  ),

  get(
    "/admin/api/types/:id",
    guard(async (c) => {
      const row = await db.one(from(contentTypes).where((q) => q("id").equals(Number(c.params.id))))
      return row ? json(c, 200, row) : json(c, 404, { error: "Content type not found" })
    }),
  ),

  post(
    "/admin/api/types",
    authed(async (c) => {
      if (claims(c).role === "viewer") return json(c, 403, { error: "Viewers cannot create content types" })

      const { name, displayName, fields } = (c.body ?? {}) as {
        name?: string
        displayName?: string
        fields?: unknown
      }
      if (!name || !displayName || !fields) {
        return json(c, 400, { error: "name, displayName, and fields are required" })
      }

      const existing = await db.one(
        from(contentTypes)
          .select("id")
          .where((q) => q("name").equals(name)),
      )
      if (existing) return json(c, 409, { error: "Content type name already exists" })

      const rows = await db.execute(
        from(contentTypes)
          .insert({ name, displayName, fields: JSON.stringify(fields) })
          .returning("id", "name", "displayName", "fields", "createdAt", "updatedAt"),
      )

      return json(c, 201, rows[0])
    }),
  ),

  put(
    "/admin/api/types/:id",
    authed(async (c) => {
      if (claims(c).role === "viewer") return json(c, 403, { error: "Viewers cannot update content types" })

      const id = Number(c.params.id)
      const { displayName, fields } = (c.body ?? {}) as { displayName?: string; fields?: unknown }

      const existing = await db.one(
        from(contentTypes)
          .select("id")
          .where((q) => q("id").equals(id)),
      )
      if (!existing) return json(c, 404, { error: "Content type not found" })

      const changes = {
        ...(displayName === undefined ? {} : { displayName }),
        ...(fields === undefined ? {} : { fields: JSON.stringify(fields) }),
        updatedAt: new Date().toISOString(),
      }

      const rows = await db.execute(
        from(contentTypes)
          .update(changes)
          .where((q) => q("id").equals(id))
          .returning("id", "name", "displayName", "fields", "createdAt", "updatedAt"),
      )

      return json(c, 200, rows[0])
    }),
  ),

  del(
    "/admin/api/types/:id",
    guard(async (c) => {
      if (claims(c).role !== "admin") return json(c, 403, { error: "Only admins can delete content types" })

      const id = Number(c.params.id)
      const existing = await db.one(
        from(contentTypes)
          .select("id")
          .where((q) => q("id").equals(id)),
      )
      if (!existing) return json(c, 404, { error: "Content type not found" })

      const inUse = await db.one(
        from(entries)
          .select("id")
          .where((q) => q("contentTypeId").equals(id)),
      )
      if (inUse) return json(c, 409, { error: "Cannot delete content type with existing entries" })

      await db.execute(
        from(contentTypes)
          .where((q) => q("id").equals(id))
          .del(),
      )

      return json(c, 200, { deleted: true })
    }),
  ),
]
