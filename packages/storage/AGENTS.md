# @atlas/storage

S3-compatible object storage with zero external dependencies.

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

```ts
await upload(store, { key: "photos/cat.jpg", body: file, contentType: "image/jpeg" })
```

### download(store, key) => Promise<Response>

Download a file. Returns the raw fetch Response.

### remove(store, key) => Promise<void>

Delete a file. No-ops on 404.

### list(store, prefix?) => Promise<{ keys, truncated }>

List objects by prefix. Returns key strings.

### presign(store, key, opts?) => string

Generate a presigned URL for direct client access.

```ts
const url = presign(store, "file.pdf", { expires: 900, method: "GET" })
```

## Testing

```sh
bun test packages/storage/          # signing + presign (no server needed)
S3_TEST=1 bun test packages/storage/ # includes operations (needs S3 server)
```

## Conventions

- Functional style, no classes
- Zero external dependencies (node:crypto only)
- All files lowercase, no dashes or underscores
