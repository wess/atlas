import { createStore, upload } from "@atlas/storage"
import { config } from "./config.ts"

const store = config.storage.s3Bucket
  ? createStore({
      endpoint: config.storage.s3Endpoint,
      bucket: config.storage.s3Bucket,
      accessKey: config.storage.s3AccessKey,
      secretKey: config.storage.s3SecretKey,
      region: config.storage.s3Region || undefined,
    })
  : null

const extension = (filename: string): string => {
  const dot = filename.lastIndexOf(".")
  return dot > 0 ? filename.slice(dot) : ""
}

export const saveUpload = async (file: File): Promise<{ key: string; url: string }> => {
  const key = `${crypto.randomUUID()}${extension(file.name)}`

  if (store) {
    return upload(store, { key, body: file, contentType: file.type })
  }

  await Bun.write(`${config.storage.path}/${key}`, file)
  return { key, url: `/uploads/${key}` }
}
