import { from } from "@atlas/db"
import { del, get, halt, json, pipe, post, putHeader, stream } from "@atlas/server"
import { config } from "../config.ts"
import { db } from "../db.ts"
import { claims, guard, uploads } from "../pipes/auth.ts"
import { media } from "../schema.ts"
import { saveUpload } from "../storage.ts"

export const mediaRoutes = [
  get(
    "/admin/api/media",
    guard(async (c) => {
      const limit = Number(c.query.limit) || 20
      const offset = Number(c.query.offset) || 0

      const base = from(media)
      const filtered = c.query.contentType ? base.where((q) => q("contentType").like(`${c.query.contentType}%`)) : base

      const rows = await db.all(filtered.orderBy("createdAt", "DESC").limit(limit).offset(offset))

      return json(c, 200, rows)
    }),
  ),

  post(
    "/admin/api/media",
    uploads(async (c) => {
      if (claims(c).role === "viewer") return json(c, 403, { error: "Viewers cannot upload media" })

      const body = c.body as { fields?: Record<string, string>; files?: Record<string, Blob> }
      const file = body.files?.file
      if (!file || !(file instanceof File)) return json(c, 400, { error: "file is required" })

      const saved = await saveUpload(file)
      const rows = await db.execute(
        from(media)
          .insert({
            filename: file.name,
            key: saved.key,
            url: saved.url,
            contentType: file.type,
            size: file.size,
            alt: body.fields?.alt ?? null,
            uploadedBy: claims(c).userId,
          })
          .returning("id", "filename", "key", "url", "contentType", "size", "alt", "uploadedBy", "createdAt"),
      )

      return json(c, 201, rows[0])
    }),
  ),

  del(
    "/admin/api/media/:id",
    guard(async (c) => {
      if (claims(c).role === "viewer") return json(c, 403, { error: "Viewers cannot delete media" })

      const id = Number(c.params.id)
      const existing = await db.one(
        from(media)
          .select("id")
          .where((q) => q("id").equals(id)),
      )
      if (!existing) return json(c, 404, { error: "Media not found" })

      await db.execute(
        from(media)
          .where((q) => q("id").equals(id))
          .del(),
      )

      return json(c, 200, { deleted: true })
    }),
  ),

  get(
    "/uploads/:key",
    pipe(async (c) => {
      const key = c.params.key ?? ""
      if (!key || key.includes("/") || key.includes("..")) return halt(c, 404, { error: "Not found" })

      const file = Bun.file(`${config.storage.path}/${key}`)
      if (!(await file.exists())) return halt(c, 404, { error: "Not found" })

      return stream(putHeader(c, "content-type", file.type), 200, file.stream())
    }),
  ),
]
