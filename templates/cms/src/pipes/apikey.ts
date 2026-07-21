import { from } from "@atlas/db"
import type { Conn } from "@atlas/server"
import { assign, halt, pipe, pipeline } from "@atlas/server"
import { db } from "../db.ts"
import { apiKeys } from "../schema.ts"
import { cors } from "./cors.ts"

const verifyKey = pipe(async (c) => {
  const key = c.headers.get("x-api-key")
  if (!key) return halt(c, 401, { error: "API key required" })

  const record = await db.one(from(apiKeys).where((q) => q("key").equals(key)))
  if (!record) return halt(c, 401, { error: "Invalid API key" })

  await db.execute(
    from(apiKeys)
      .update({ lastUsedAt: new Date().toISOString() })
      .where((q) => q("id").equals(record.id)),
  )

  return assign(c, { apiKey: record })
})

export const apiKeyAuth = pipeline(cors, verifyKey)

export const keyPermissions = (c: Conn): string[] => {
  const { permissions } = c.assigns.apiKey as { permissions: unknown }
  if (typeof permissions === "string") return JSON.parse(permissions)
  return Array.isArray(permissions) ? permissions : []
}
