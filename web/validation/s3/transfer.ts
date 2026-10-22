import { createStore, download, list, presign, remove, stat, upload } from "@wess/atlas/storage";
import { sha256, signRequest } from "@wess/atlas/storage/signing";

const store = createStore({
  endpoint: process.env.S3_ENDPOINT!,
  bucket: process.env.S3_BUCKET!,
  accessKey: process.env.S3_ACCESS_KEY!,
  secretKey: process.env.S3_SECRET_KEY!,
});
const signed = async (method: string, url: URL, body?: Uint8Array | string): Promise<Response> => {
  const headers = new Headers({ host: url.host });
  const result = signRequest({ method, url, headers, body, ...store });
  headers.set("authorization", result.authorization);
  const response = await fetch(url, { method, headers, body: body as RequestInit["body"] });
  if (!response.ok) throw new Error(`S3 ${method} returned ${response.status}: ${await response.text()}`);
  return response;
};

const key = `packed/${crypto.randomUUID()}/résumé #?%&.txt`;
try {
  const bytes = crypto.getRandomValues(new Uint8Array(32 * 1024));
  await upload(store, {
    key,
    maxBytes: bytes.length,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    contentType: "application/octet-stream",
  });
  const body = new Uint8Array(await (await download(store, key)).arrayBuffer());
  if (sha256(body) !== sha256(bytes)) throw new Error("S3 streamed upload digest differs");
  if ((await stat(store, key))?.size !== bytes.length) throw new Error("S3 object size differs");
  if (!(await list(store, key)).keys.includes(key)) throw new Error("S3 listing changed the object key");
  const range = await fetch(presign(store, key), { headers: { range: "bytes=1-3" } });
  if (range.status !== 206 || sha256(new Uint8Array(await range.arrayBuffer())) !== sha256(bytes.subarray(1, 4))) {
    throw new Error("S3 signed range transfer differs");
  }
} finally {
  await remove(store, key);
}

const multipart = new URL(`/${store.bucket}/packed/multipart`, store.endpoint);
multipart.searchParams.set("uploads", "");
const initiation = await signed("POST", multipart);
const id = (await initiation.text()).match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
if (!id) throw new Error("S3 did not return a multipart upload id");
multipart.searchParams.delete("uploads");
multipart.searchParams.set("uploadId", id);
try {
  const parts = [new Uint8Array(5 * 1024 * 1024).fill(17), new Uint8Array(1024).fill(29)];
  const completed: string[] = [];
  for (const [index, bytes] of parts.entries()) {
    multipart.searchParams.set("partNumber", String(index + 1));
    const response = await signed("PUT", multipart, bytes);
    const etag = response.headers.get("etag");
    if (!etag) throw new Error("S3 did not return a part ETag");
    completed.push(`<Part><PartNumber>${index + 1}</PartNumber><ETag>${etag}</ETag></Part>`);
  }
  multipart.searchParams.delete("partNumber");
  await signed("POST", multipart, `<CompleteMultipartUpload>${completed.join("")}</CompleteMultipartUpload>`);
  const object = await download(store, "packed/multipart");
  const expected = new Blob(parts);
  if (sha256(new Uint8Array(await object.arrayBuffer())) !== sha256(new Uint8Array(await expected.arrayBuffer()))) {
    throw new Error("S3 multipart digest differs");
  }
  await remove(store, "packed/multipart");
} finally {
  multipart.searchParams.delete("partNumber");
  // aborting an already-completed upload is harmless, and cleans up failed attempts
  const headers = new Headers({ host: multipart.host });
  const result = signRequest({ method: "DELETE", url: multipart, headers, ...store });
  headers.set("authorization", result.authorization);
  await fetch(multipart, { method: "DELETE", headers });
}
console.log("Packed S3 streams, exact keys, signed ranges, and multipart transfers passed");
