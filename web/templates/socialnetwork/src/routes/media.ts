import { from } from "@atlas/db"
import { get, halt, json, pipe, post, putHeader, stream } from "@atlas/server"
import { config } from "../config.ts"
import { db } from "../db.ts"
import { currentUserId, uploads } from "../pipes/auth.ts"
import { media } from "../schema.ts"
import { saveUpload } from "../storage.ts"

const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]

export const mediaRoutes = [
  post(
    "/api/media/upload",
    uploads(async (c) => {
      const body = c.body as { files?: Record<string, Blob> }
      const file = body.files?.file

      if (!file || !(file instanceof File)) return json(c, 400, { error: "file is required" })
      if (!allowedTypes.includes(file.type)) {
        return json(c, 400, { error: "Only jpeg, png, gif, and webp images are allowed" })
      }

      const saved = await saveUpload(file)
      const rows = await db.execute(
        from(media)
          .insert({ userId: currentUserId(c), key: saved.key, url: saved.url, contentType: file.type })
          .returning("id", "key", "url", "contentType", "createdAt"),
      )

      return json(c, 201, rows[0])
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
