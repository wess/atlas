import { signRequest } from "../signing/index.ts";
import type { Store } from "../store/index.ts";

export type UploadOptions = {
  key: string;
  body: Blob | Uint8Array | string | ReadableStream;
  contentType?: string;
};

export type ListResult = {
  keys: string[];
  truncated: boolean;
};

const makeUrl = (store: Store, key: string): URL => new URL(`/${store.bucket}/${key}`, store.endpoint);

const toBytes = async (
  body: Blob | Uint8Array | string | ReadableStream | null | undefined,
): Promise<Uint8Array | null> => {
  if (!body) return null;
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  // ReadableStream — collect chunks
  const reader = (body as ReadableStream).getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};

const signedFetch = async (
  store: Store,
  method: string,
  url: URL,
  opts?: { body?: Blob | Uint8Array | string | ReadableStream | null; headers?: Record<string, string> },
): Promise<Response> => {
  const headers = new Headers({
    host: url.host,
    ...(opts?.headers ?? {}),
  });

  const bodyBytes = await toBytes(opts?.body);

  const signed = signRequest({
    method,
    url,
    headers,
    body: bodyBytes,
    accessKey: store.accessKey,
    secretKey: store.secretKey,
    region: store.region,
    service: "s3",
  });

  headers.set("authorization", signed.authorization);

  return fetch(url.toString(), {
    method,
    headers,
    body: bodyBytes,
  });
};

export const upload = async (store: Store, opts: UploadOptions): Promise<{ key: string; url: string }> => {
  const url = makeUrl(store, opts.key);
  const extra: Record<string, string> = {};
  if (opts.contentType) extra["content-type"] = opts.contentType;

  const res = await signedFetch(store, "PUT", url, {
    body: opts.body,
    headers: extra,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Storage upload failed for key '${opts.key}': HTTP ${res.status}. Response: ${text}. Check your S3_ENDPOINT, S3_BUCKET, and credentials.`,
    );
  }

  return { key: opts.key, url: url.toString() };
};

export const download = async (store: Store, key: string): Promise<Response> => {
  const url = makeUrl(store, key);
  const res = await signedFetch(store, "GET", url);
  if (!res.ok)
    throw new Error(
      `Storage download failed for key '${key}': HTTP ${res.status}. Verify the key exists and credentials are correct.`,
    );
  return res;
};

export const remove = async (store: Store, key: string): Promise<void> => {
  const url = makeUrl(store, key);
  const res = await signedFetch(store, "DELETE", url);
  if (!res.ok && res.status !== 404) {
    throw new Error(
      `Storage delete failed for key '${key}': HTTP ${res.status}. Check your S3 credentials and permissions.`,
    );
  }
};

export const list = async (store: Store, prefix?: string): Promise<ListResult> => {
  const url = new URL(`/${store.bucket}`, store.endpoint);
  url.searchParams.set("list-type", "2");
  if (prefix) url.searchParams.set("prefix", prefix);

  const res = await signedFetch(store, "GET", url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Storage list failed: HTTP ${res.status}. Response: ${text}. Check your S3_ENDPOINT and credentials.`,
    );
  }

  const xml = await res.text();
  const keys = extractXmlValues(xml, "Key");
  const truncated = xml.includes("<IsTruncated>true</IsTruncated>");

  return { keys, truncated };
};

const extractXmlValues = (xml: string, tag: string): string[] => {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, "g");
  let match = regex.exec(xml);
  while (match !== null) {
    results.push(match[1]!);
    match = regex.exec(xml);
  }
  return results;
};
