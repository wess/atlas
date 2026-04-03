import { get, post, del, json } from "@atlas/server"
import { upload } from "@atlas/storage"
import { db } from "../db.ts"
import { config } from "../config.ts"
import { authed } from "../pipes/auth.ts"

export const mediaRoutes = [
  get("/admin/api/media", authed(
    async (c) => {
      const limit = Number(c.query.limit) || 20
      const offset = Number(c.query.offset) || 0
      const contentType = c.query.contentType

      let sql = `select id, filename, key, url, content_type, size, alt, uploaded_by, created_at
        from media where 1=1`
      const params: unknown[] = []
      let paramIdx = 1

      if (contentType) {
        sql += ` and content_type like $${paramIdx++}`
        params.push(`${contentType}%`)
      }

      sql += ` order by created_at desc limit $${paramIdx++} offset $${paramIdx++}`
      params.push(limit, offset)

      const rows = await db.query(sql, params)

      return json(c, 200, rows)
    },
  )),

  post("/admin/api/media", authed(
    async (c) => {
      if (c.auth.role === "viewer") {
        return json(c, 403, { error: "Viewers cannot upload media" })
      }

      const formData = await c.req.formData()
      const file = formData.get("file")
      const alt = formData.get("alt") as string | null

      if (!file || !(file instanceof File)) {
        return json(c, 400, { error: "file is required" })
      }

      const result = await upload(file, {
        bucket: config.storage.s3Bucket,
        region: config.storage.s3Region,
        accessKey: config.storage.s3AccessKey,
        secretKey: config.storage.s3SecretKey,
        localPath: config.storage.path,
      })

      const rows = await db.query(
        `insert into media (filename, key, url, content_type, size, alt, uploaded_by)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id, filename, key, url, content_type, size, alt, uploaded_by, created_at`,
        [file.name, result.key, result.url, file.type, file.size, alt || null, c.auth.userId],
      )

      return json(c, 201, rows[0])
    },
  )),

  del("/admin/api/media/:id", authed(
    async (c) => {
      if (c.auth.role === "viewer") {
        return json(c, 403, { error: "Viewers cannot delete media" })
      }

      const existing = await db.query(
        "select id from media where id = $1",
        [c.params.id],
      )

      if (existing.length === 0) {
        return json(c, 404, { error: "Media not found" })
      }

      await db.query("delete from media where id = $1", [c.params.id])

      return json(c, 200, { deleted: true })
    },
  )),
]
