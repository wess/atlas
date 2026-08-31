import { from } from "@atlas/db"
import { del, get, json, post } from "@atlas/server"
import { db } from "../db.ts"
import { authed, claims, guard } from "../pipes/auth.ts"
import { apiKeys } from "../schema.ts"

const generateApiKey = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export const keyRoutes = [
  get(
    "/admin/api/keys",
    guard(async (c) => {
      if (claims(c).role !== "admin") return json(c, 403, { error: "Only admins can manage API keys" })

      const rows = await db.all(from(apiKeys).orderBy("createdAt", "DESC"))
      return json(c, 200, rows)
    }),
  ),

  post(
    "/admin/api/keys",
    authed(async (c) => {
      if (claims(c).role !== "admin") return json(c, 403, { error: "Only admins can manage API keys" })

      const { name, permissions } = (c.body ?? {}) as { name?: string; permissions?: string[] }
      if (!name) return json(c, 400, { error: "name is required" })

      const rows = await db.execute(
        from(apiKeys)
          .insert({ name, key: generateApiKey(), permissions: JSON.stringify(permissions ?? []) })
          .returning("id", "name", "key", "permissions", "createdAt", "lastUsedAt"),
      )

      return json(c, 201, rows[0])
    }),
  ),

  del(
    "/admin/api/keys/:id",
    guard(async (c) => {
      if (claims(c).role !== "admin") return json(c, 403, { error: "Only admins can manage API keys" })

      const id = Number(c.params.id)
      const existing = await db.one(
        from(apiKeys)
          .select("id")
          .where((q) => q("id").equals(id)),
      )
      if (!existing) return json(c, 404, { error: "API key not found" })

      await db.execute(
        from(apiKeys)
          .where((q) => q("id").equals(id))
          .del(),
      )

      return json(c, 200, { deleted: true })
    }),
  ),
]
