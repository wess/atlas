import { get, post, del, json } from "@atlas/server"
import { db } from "../db.ts"
import { authed } from "../pipes/auth.ts"

const generateApiKey = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
}

export const keyRoutes = [
  get("/admin/api/keys", authed(
    async (c) => {
      if (c.auth.role !== "admin") {
        return json(c, 403, { error: "Only admins can manage API keys" })
      }

      const rows = await db.query(
        "select id, name, key, permissions, created_at, last_used_at from api_keys order by created_at desc",
      )

      return json(c, 200, rows)
    },
  )),

  post("/admin/api/keys", authed(
    async (c) => {
      if (c.auth.role !== "admin") {
        return json(c, 403, { error: "Only admins can manage API keys" })
      }

      const { name, permissions } = await c.req.json()

      if (!name) {
        return json(c, 400, { error: "name is required" })
      }

      const key = generateApiKey()

      const rows = await db.query(
        `insert into api_keys (name, key, permissions)
         values ($1, $2, $3)
         returning id, name, key, permissions, created_at, last_used_at`,
        [name, key, JSON.stringify(permissions || [])],
      )

      return json(c, 201, rows[0])
    },
  )),

  del("/admin/api/keys/:id", authed(
    async (c) => {
      if (c.auth.role !== "admin") {
        return json(c, 403, { error: "Only admins can manage API keys" })
      }

      const existing = await db.query(
        "select id from api_keys where id = $1",
        [c.params.id],
      )

      if (existing.length === 0) {
        return json(c, 404, { error: "API key not found" })
      }

      await db.query("delete from api_keys where id = $1", [c.params.id])

      return json(c, 200, { deleted: true })
    },
  )),
]
