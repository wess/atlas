import { post, json } from "@atlas/server"
import { upload } from "@atlas/storage"
import { db } from "../db.ts"
import { config } from "../config.ts"
import { authed } from "../pipes/auth.ts"

export const mediaRoutes = [
  post("/api/media/upload", authed(
    async (c) => {
      const formData = await c.req.formData()
      const file = formData.get("file")

      if (!file || !(file instanceof File)) {
        return json(c, 400, { error: "file is required" })
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]

      if (!allowedTypes.includes(file.type)) {
        return json(c, 400, { error: "Only jpeg, png, gif, and webp images are allowed" })
      }

      const result = await upload(file, {
        bucket: config.storage.s3Bucket,
        region: config.storage.s3Region,
        accessKey: config.storage.s3AccessKey,
        secretKey: config.storage.s3SecretKey,
        localPath: config.storage.path,
      })

      const rows = await db.query(
        `insert into media (user_id, key, url, content_type)
         values ($1, $2, $3, $4)
         returning id, key, url, content_type, created_at`,
        [c.auth.userId, result.key, result.url, file.type],
      )

      return json(c, 201, rows[0])
    },
  )),
]
