import { from } from "@atlas/db"
import { del, get, json, post, put } from "@atlas/server"
import { db } from "../db.ts"
import { authed, claims, guard } from "../pipes/auth.ts"
import { webhooks } from "../schema.ts"

export const webhookRoutes = [
  get(
    "/admin/api/webhooks",
    guard(async (c) => {
      if (claims(c).role !== "admin") return json(c, 403, { error: "Only admins can manage webhooks" })

      const rows = await db.all(from(webhooks).orderBy("createdAt", "DESC"))
      return json(c, 200, rows)
    }),
  ),

  post(
    "/admin/api/webhooks",
    authed(async (c) => {
      if (claims(c).role !== "admin") return json(c, 403, { error: "Only admins can manage webhooks" })

      const { url, events } = (c.body ?? {}) as { url?: string; events?: unknown }
      if (!url || !Array.isArray(events)) {
        return json(c, 400, { error: "url and events array are required" })
      }

      const rows = await db.execute(
        from(webhooks)
          .insert({ url, events: JSON.stringify(events), secret: crypto.randomUUID(), active: 1 })
          .returning("id", "url", "events", "secret", "active", "createdAt"),
      )

      return json(c, 201, rows[0])
    }),
  ),

  put(
    "/admin/api/webhooks/:id",
    authed(async (c) => {
      if (claims(c).role !== "admin") return json(c, 403, { error: "Only admins can manage webhooks" })

      const id = Number(c.params.id)
      const { url, events, active } = (c.body ?? {}) as { url?: string; events?: unknown; active?: boolean }

      const existing = await db.one(
        from(webhooks)
          .select("id")
          .where((q) => q("id").equals(id)),
      )
      if (!existing) return json(c, 404, { error: "Webhook not found" })

      const changes = {
        ...(url === undefined ? {} : { url }),
        ...(Array.isArray(events) ? { events: JSON.stringify(events) } : {}),
        ...(active === undefined ? {} : { active: active ? 1 : 0 }),
      }
      if (Object.keys(changes).length === 0) return json(c, 400, { error: "Nothing to update" })

      const rows = await db.execute(
        from(webhooks)
          .update(changes)
          .where((q) => q("id").equals(id))
          .returning("id", "url", "events", "secret", "active", "createdAt"),
      )

      return json(c, 200, rows[0])
    }),
  ),

  del(
    "/admin/api/webhooks/:id",
    guard(async (c) => {
      if (claims(c).role !== "admin") return json(c, 403, { error: "Only admins can manage webhooks" })

      const id = Number(c.params.id)
      const existing = await db.one(
        from(webhooks)
          .select("id")
          .where((q) => q("id").equals(id)),
      )
      if (!existing) return json(c, 404, { error: "Webhook not found" })

      await db.execute(
        from(webhooks)
          .where((q) => q("id").equals(id))
          .del(),
      )

      return json(c, 200, { deleted: true })
    }),
  ),
]
