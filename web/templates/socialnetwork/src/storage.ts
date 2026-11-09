import { createStore, upload } from "@wess/atlas/storage"
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

type Kind = { readonly type: string; readonly extension: string; readonly matches: (head: Uint8Array) => boolean }

const startsWith = (head: Uint8Array, bytes: readonly number[], offset = 0) =>
  bytes.every((byte, i) => head[offset + i] === byte)

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))

// Uploads are served from this origin, so the client's filename and content type are never trusted.
// The type comes from the file's first bytes, and anything not on this list is refused.
const kinds: readonly Kind[] = [
  { type: "image/png", extension: "png", matches: (head) => startsWith(head, [0x89, 0x50, 0x4e, 0x47]) },
  { type: "image/jpeg", extension: "jpg", matches: (head) => startsWith(head, [0xff, 0xd8, 0xff]) },
  { type: "image/gif", extension: "gif", matches: (head) => startsWith(head, ascii("GIF8")) },
  {
    type: "image/webp",
    extension: "webp",
    matches: (head) => startsWith(head, ascii("RIFF")) && startsWith(head, ascii("WEBP"), 8),
  },
]

export const sniff = async (file: Blob): Promise<Kind | null> => {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  return kinds.find((kind) => kind.matches(head)) ?? null
}

// The key is random; only the extension carries meaning, and it maps back to a sniffed type.
export const kindForKey = (key: string): Kind | null => {
  const match = /^[0-9a-f-]{36}\.([a-z]+)$/.exec(key)
  return kinds.find((kind) => kind.extension === match?.[1]) ?? null
}

export const saveUpload = async (file: File): Promise<{ key: string; url: string; contentType: string } | null> => {
  const kind = await sniff(file)
  if (!kind) return null

  const key = `${crypto.randomUUID()}.${kind.extension}`

  if (store) {
    const saved = await upload(store, { key, body: file, contentType: kind.type })
    return { ...saved, contentType: kind.type }
  }

  await Bun.write(`${config.storage.path}/${key}`, file)
  return { key, url: `/uploads/${key}`, contentType: kind.type }
}
