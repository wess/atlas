import { createHmac } from "node:crypto";
import { hmacSha256, sha256 } from "../signing/index.ts";
import type { Store } from "../store/index.ts";
import { canonicalPath, objectUrl, uriEncode } from "../url/index.ts";

const getSigningKey = (secretKey: string, dateStamp: string, region: string, service: string): Buffer => {
  const kDate = hmacSha256(Buffer.from(`AWS4${secretKey}`), dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
};

// S3 caps presigned URL lifetime at 7 days (604800s). Anything above is
// rejected at fetch time, so clamp here and surface a clear error if the
// caller asks for a non-positive value.
const MAX_PRESIGN_SECONDS = 604800;

// query adds signed parameters, e.g. response-content-disposition for a download's filename.
export const presign = (
  store: Store,
  key: string,
  opts?: { expires?: number; method?: string; query?: Record<string, string> },
): string => {
  const requested = opts?.expires ?? 3600;
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new Error("presign: `expires` must be a positive number of seconds");
  }
  const expires = Math.min(Math.floor(requested), MAX_PRESIGN_SECONDS);
  const method = opts?.method ?? "GET";

  const url = objectUrl(store, key);
  const now = new Date();
  const amzDate = `${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${store.region}/s3/aws4_request`;
  const credential = `${store.accessKey}/${scope}`;

  for (const [name, value] of Object.entries(opts?.query ?? {})) {
    if (name.toLowerCase().startsWith("x-amz-")) throw new Error(`presign: \`${name}\` is reserved for signing`);
    url.searchParams.set(name, value);
  }
  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  url.searchParams.set("X-Amz-Credential", credential);
  url.searchParams.set("X-Amz-Date", amzDate);
  url.searchParams.set("X-Amz-Expires", expires.toString());
  url.searchParams.set("X-Amz-SignedHeaders", "host");

  // Build canonical request for presigned URL

  // Query params must be sorted for canonical request
  const sortedParams = [...url.searchParams.entries()]
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .sort()
    .join("&");

  const canonicalHeaders = `host:${url.host}\n`;
  const signedHeaders = "host";

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalPath(url),
    sortedParams,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");

  const signingKey = getSigningKey(store.secretKey, dateStamp, store.region, "s3");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  url.searchParams.set("X-Amz-Signature", signature);

  return url.toString();
};
