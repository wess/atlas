import { prepareBody } from "../body/index.ts";
import { signRequest } from "../signing/index.ts";
import type { Store } from "../store/index.ts";
import { objectUrl } from "../url/index.ts";

export type UploadOptions = {
  key: string;
  body: Blob | Uint8Array | string | ReadableStream;
  contentType?: string;
  acl?: "private" | "public-read";
  maxBytes?: number;
  signal?: AbortSignal;
};

export type ListResult = {
  keys: string[];
  truncated: boolean;
};

const makeUrl = objectUrl;

const signedFetch = async (
  store: Store,
  method: string,
  url: URL,
  opts?: {
    body?: Blob | Uint8Array | string | ReadableStream | null;
    headers?: Record<string, string>;
    maxBytes?: number;
    signal?: AbortSignal;
  },
): Promise<Response> => {
  const headers = new Headers({ host: url.host, ...(opts?.headers ?? {}) });
  const payload = await prepareBody(opts?.body, opts?.maxBytes, opts?.signal);
  try {
    const signed = signRequest({
      method,
      url,
      headers,
      payloadHash: payload.hash,
      accessKey: store.accessKey,
      secretKey: store.secretKey,
      region: store.region,
      service: "s3",
    });
    headers.set("authorization", signed.authorization);
    return await fetch(url.toString(), {
      method,
      headers,
      body: payload.body as unknown as RequestInit["body"],
      signal: opts?.signal,
    });
  } finally {
    await payload.dispose?.();
  }
};

export const upload = async (store: Store, opts: UploadOptions): Promise<{ key: string; url: string }> => {
  const url = makeUrl(store, opts.key);
  const extra: Record<string, string> = {};
  if (opts.contentType) extra["content-type"] = opts.contentType;
  if (opts.acl) extra["x-amz-acl"] = opts.acl;

  const res = await signedFetch(store, "PUT", url, {
    body: opts.body,
    headers: extra,
    maxBytes: opts.maxBytes,
    signal: opts.signal,
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

export type ObjectStat = { size: number; contentType: string | null; etag: string | null };

// null when the object does not exist.
export const stat = async (store: Store, key: string): Promise<ObjectStat | null> => {
  const res = await signedFetch(store, "HEAD", makeUrl(store, key));
  if (res.status === 404) return null;
  if (!res.ok)
    throw new Error(
      `Storage stat failed for key '${key}': HTTP ${res.status}. Check your S3 credentials and permissions.`,
    );
  return {
    size: Number(res.headers.get("content-length") ?? 0),
    contentType: res.headers.get("content-type"),
    etag: res.headers.get("etag"),
  };
};

export const list = async (store: Store, prefix?: string): Promise<ListResult> => {
  const url = objectUrl(store, "");
  url.pathname = url.pathname.slice(0, -1);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("encoding-type", "url");
  if (prefix) url.searchParams.set("prefix", prefix);

  const res = await signedFetch(store, "GET", url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Storage list failed: HTTP ${res.status}. Response: ${text}. Check your S3_ENDPOINT and credentials.`,
    );
  }

  const xml = await res.text();
  const encoded = /<EncodingType>\s*url\s*<\/EncodingType>/.test(xml);
  const keys = extractXmlValues(xml, "Key").map((key) => (encoded ? decodeURIComponent(key) : key));
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
