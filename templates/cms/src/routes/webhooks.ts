import { get, post, put, del, json } from "@atlas/server"
import { db } from "../db.ts"
import { authed } from "../pipes/auth.ts"

export const webhookRoutes = [
  get("/admin/api/webhooks", authed(
    async (c) => {
      if (c.auth.role !== "admin") {
        return json(c, 403, { error: "Only admins can manage webhooks" })
      }

      const rows = await db.query(
        "select id, url, events, secret, active, created_at from webhooks order by created_at desc",
      )

      return json(c, 200, rows)
    },
  )),

  post("/admin/api/webhooks", authed(
    async (c) => {
      if (c.auth.role !== "admin") {
        return json(c, 403, { error: "Only admins can manage webhooks" })
      }

      const { url, events } = await c.req.json()

      if (!url || !events || !Array.isArray(events)) {
        return json(c, 400, { error: "url and events array are required" })
      }

      const secret = crypto.randomUUID()

      const rows = await db.query(
        `insert into webhooks (url, events, secret, active)
         values ($1, $2, $3, 1)
         returning id, url, events, secret, active, created_at`,
        [url, JSON.stringify(events), secret],
      )

      return json(c, 201, rows[0])
    },
  )),

  put("/admin/api/webhooks/:id", authed(
    async (c) => {
      if (c.auth.role !== "admin") {
        return json(c, 403, { error: "Only admins can manage webhooks" })
      }

      const { url, events, active } = await c.req.json()

      const existing = await db.query(
        "select id from webhooks where id = $1",
        [c.params.id],
      )

      if (existing.length === 0) {
        return json(c, 404, { error: "Webhook not found" })
      }

      const rows = await db.query(
        `update webhooks
         set url = coalesce($1, url),
             events = coalesce($2, events),
             active = coalesce($3, active)
         where id = $4
         returning id, url, events, secret, active, created_at`,
        [url || null, events ? JSON.stringify(events) : null, active !== undefined ? (active ? 1 : 0) : null, c.params.id],
      )

      return json(c, 200, rows[0])
    },
  )),

  del("/admin/api/webhooks/:id", authed(
    async (c) => {
      if (c.auth.role !== "admin") {
        return json(c, 403, { error: "Only admins can manage webhooks" })
      }

      const existing = await db.query(
        "select id from webhooks where id = $1",
        [c.params.id],
      )

      if (existing.length === 0) {
        return json(c, 404, { error: "Webhook not found" })
      }

      await db.query("delete from webhooks where id = $1", [c.params.id])

      return json(c, 200, { deleted: true })
    },
  )),
]
