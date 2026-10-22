# @wess/atlas/storage

S3-compatible object storage with zero external dependencies.

## Exports

- `createStore(opts)` → `Store`
- `upload(store, { key, body, contentType?, acl?, maxBytes?, signal? })` → `Promise<{ key, url }>`
- `download(store, key)` → `Promise<Response>`
- `remove(store, key)` → `Promise<void>` (no-ops on 404)
- `stat(store, key)` → `Promise<{ size, contentType, etag } | null>` (null on 404)
- `list(store, prefix?)` → `Promise<ListResult>`
- `presign(store, key, { expires?, method?, query? })` → `string`

## Types

- `Store = { endpoint, bucket, region, accessKey, secretKey }`
- `UploadOptions = { key; body: string | Uint8Array | Blob | ReadableStream; contentType?; acl?: "private" | "public-read"; maxBytes?: number; signal?: AbortSignal }`
- `ListResult = { keys: string[]; truncated: boolean }`

## Architecture

- `store/` — Store type and createStore factory
- `signing/` — AWS Signature V4 implementation using node:crypto
- `operations/` — upload, download, remove, list (signed S3 requests)
- `presign/` — presigned URL generation for direct client access

## API

### createStore(opts) => Store

Creates a store configuration object.

```ts
const store = createStore({
  endpoint: "http://localhost:9000",
  bucket: "mybucket",
  accessKey: "minioadmin",
  secretKey: "minioadmin",
  region: "us-east-1", // optional, defaults to us-east-1
})
```

### upload(store, opts) => Promise<{ key, url }>

Upload a file. Body can be string, Uint8Array, Blob, or ReadableStream.
Uploads default to a 5 GiB limit; set `maxBytes` to an application's smaller bound.
`signal` cancels hashing, stream preparation, and the HTTP request. Blobs are hashed
incrementally and replayed without a whole-file buffer. One-shot byte streams use
a private temporary file, removed on success, failure, or cancellation. Allow enough
temporary disk space for concurrent uploads; use multipart transfers for larger files.

```ts
await upload(store, { key: "photos/cat.jpg", body: file, contentType: "image/jpeg" })

// public media served directly from a bucket or CDN
await upload(store, {
  key: "media/photo.jpg",
  body: file,
  contentType: "image/jpeg",
  acl: "public-read",
})
```

ACL is per upload. Omitting it sends no `x-amz-acl` header, preserving the default
private upload behavior. Set `"private"` explicitly when needed, or `"public-read"`
for public objects on providers that support object ACLs. The ACL header is included
in the request signature. No bucket policy or store-wide setting is changed.

Keys are encoded once, preserving spaces, Unicode, `%`, `?`, and `#`. Dot path
segments (`.` or `..`) are rejected because URL normalization would change the key.
`@wess/atlas/storage/signing` exports `signRequest`, `sha256`, and `hmacSha256`.
`signRequest` accepts `payloadHash` for an already-computed SHA-256 hex digest;
callers must ensure the digest matches the actual body.

### download(store, key) => Promise<Response>

Download a file. Returns the raw fetch Response.

### remove(store, key) => Promise<void>

Delete a file. No-ops on 404.

### list(store, prefix?) => Promise<{ keys, truncated }>

List objects by prefix. Requests URL-encoded keys in the S3 XML response and
decodes them once, preserving reserved characters, line breaks, and Unicode.

### presign(store, key, opts?) => string

Generate a presigned URL for direct client access.

```ts
const url = presign(store, "file.pdf", { expires: 900, method: "GET" })

// signed extra parameters, e.g. the filename a download saves as
presign(store, "files/a1b2", {
  query: { "response-content-disposition": 'attachment; filename="brushes.zip"' },
})
```

A browser upload straight to the bucket is a presigned `PUT`. The bucket needs a CORS
rule allowing `PUT` from the app's origin.

### stat(store, key) => Promise<{ size, contentType, etag } | null>

Signed `HEAD`. Returns null when the object is missing, so an app can confirm a direct
browser upload actually landed before trusting it.

## Testing

```sh
bun test packages/storage/          # signing + presign (no server needed)
S3_TEST=1 bun test packages/storage/ # includes operations (needs S3 server)
```

## Conventions

- Functional style, no classes
- Zero external dependencies (node:crypto only)
- All files lowercase, no dashes or underscores

## Dependencies

- Sibling packages: none — `@wess/atlas/storage` is standalone.
- External: none. Uses `node:crypto` for AWS Signature V4 and `fetch` for transport.
