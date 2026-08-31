import { createHash, createHmac } from "node:crypto";

export type SigningOptions = {
  method: string;
  url: URL;
  headers: Headers;
  body?: Uint8Array | string | null;
  accessKey: string;
  secretKey: string;
  region?: string;
  service?: string;
};

export type SigningResult = {
  authorization: string;
  date: string;
  contentHash: string;
};

export const sha256 = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");

export const hmacSha256 = (key: string | Buffer | Uint8Array, data: string): Buffer =>
  createHmac("sha256", key).update(data).digest();

const getSigningKey = (secretKey: string, dateStamp: string, region: string, service: string): Buffer => {
  const kDate = hmacSha256(Buffer.from(`AWS4${secretKey}`), dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
};

const uriEncode = (str: string, encodeSlash = true): string => {
  const encoded = encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
  return encodeSlash ? encoded : encoded.replace(/%2F/g, "/");
};

const getCanonicalQueryString = (url: URL): string => {
  const params = [...url.searchParams.entries()];
  if (params.length === 0) return "";
  return params
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .sort()
    .join("&");
};

const getCanonicalHeaders = (headers: Headers, signedHeaderKeys: string[]): string =>
  `${signedHeaderKeys.map((k) => `${k}:${(headers.get(k) ?? "").trim().replace(/\s+/g, " ")}`).join("\n")}\n`;

const getSignedHeaderKeys = (headers: Headers): string[] => [...headers.keys()].map((k) => k.toLowerCase()).sort();

export const signRequest = (opts: SigningOptions): SigningResult => {
  const { method, url, headers, body, accessKey, secretKey, region = "us-east-1", service = "s3" } = opts;

  const now = new Date();
  const amzDate = `${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  const dateStamp = amzDate.slice(0, 8);

  const contentHash = sha256(body ?? "");

  headers.set("x-amz-date", amzDate);
  headers.set("x-amz-content-sha256", contentHash);

  if (!headers.has("host")) {
    headers.set("host", url.host);
  }

  const signedHeaderKeys = getSignedHeaderKeys(headers);
  const signedHeadersStr = signedHeaderKeys.join(";");
  const canonicalHeaders = getCanonicalHeaders(headers, signedHeaderKeys);

  const canonicalPath = uriEncode(url.pathname, false) || "/";
  const canonicalQueryString = getCanonicalQueryString(url);

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalPath,
    canonicalQueryString,
    canonicalHeaders,
    signedHeadersStr,
    contentHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;

  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");

  const signingKey = getSigningKey(secretKey, dateStamp, region, service);
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  return { authorization, date: amzDate, contentHash };
};
