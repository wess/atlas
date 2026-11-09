import { from } from "@wess/atlas/db/query";
import { get, halt, json, pipe, post, putHeader, stream } from "@wess/atlas/server"
import { config } from "../config.ts"
import { db } from "../db.ts"
import { currentUserId, uploads } from "../pipes/auth.ts"
import { media } from "../schema.ts"
import { kindForKey, saveUpload } from "../storage.ts"

export const mediaRoutes = [
  post(
    "/api/media/upload",
    uploads(async (c) => {
      const body = c.body as { files?: Record<string, Blob> }
      const file = body.files?.file

      if (!file || !(file instanceof File)) return json(c, 400, { error: "file is required" })

      const saved = await saveUpload(file)
      if (!saved) return json(c, 400, { error: "Only jpeg, png, gif, and webp images are allowed" })

      const rows = await db.execute(
        from(media)
          .insert({ userId: currentUserId(c), key: saved.key, url: saved.url, contentType: saved.contentType })
          .returning("id", "key", "url", "contentType", "createdAt"),
      )

      return json(c, 201, rows[0])
    }),
  ),

  get(
    "/uploads/:key",
    pipe(async (c) => {
      const key = c.params.key ?? ""
      const kind = kindForKey(key)
      if (!kind) return halt(c, 404, { error: "Not found" })

      const file = Bun.file(`${config.storage.path}/${key}`)
      if (!(await file.exists())) return halt(c, 404, { error: "Not found" })

      // nosniff and a sandbox CSP keep a mislabeled file from running as a page on this origin
      const headers = {
        "content-type": kind.type,
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      }
      const conn = Object.entries(headers).reduce((acc, [name, value]) => putHeader(acc, name, value), c)
      return stream(conn, 200, file.stream())
    }),
  ),
]
