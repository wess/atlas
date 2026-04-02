import { createHash, createHmac } from "node:crypto";
import { hmacSha256, sha256 } from "../signing/index.ts";
import type { Store } from "../store/index.ts";

const uriEncode = (str: string, encodeSlash = true): string => {
  const encoded = encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
  return encodeSlash ? encoded : encoded.replace(/%2F/g, "/");
};

const getSigningKey = (secretKey: string, dateStamp: string, region: string, service: string): Buffer => {
  const kDate = hmacSha256(Buffer.from(`AWS4${secretKey}`), dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
};

export const presign = (store: Store, key: string, opts?: { expires?: number; method?: string }): string => {
  const expires = opts?.expires ?? 3600;
  const method = opts?.method ?? "GET";

  const url = new URL(`/${store.bucket}/${key}`, store.endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${store.region}/s3/aws4_request`;
  const credential = `${store.accessKey}/${scope}`;

  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  url.searchParams.set("X-Amz-Credential", credential);
  url.searchParams.set("X-Amz-Date", amzDate);
  url.searchParams.set("X-Amz-Expires", expires.toString());
  url.searchParams.set("X-Amz-SignedHeaders", "host");

  // Build canonical request for presigned URL
  const canonicalPath = uriEncode(url.pathname, false) || "/";

  // Query params must be sorted for canonical request
  const sortedParams = [...url.searchParams.entries()]
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .sort()
    .join("&");

  const canonicalHeaders = `host:${url.host}\n`;
  const signedHeaders = "host";

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalPath,
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
