const encoder = new TextEncoder();
const decoder = new TextDecoder();

const base64url = {
  encode: (data: Uint8Array): string => Buffer.from(data).toString("base64url"),
  decode: (str: string): Uint8Array => new Uint8Array(Buffer.from(str, "base64url")),
};

const hmacSign = async (data: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64url.encode(new Uint8Array(sig));
};

const hmacVerify = async (data: string, signature: string, secret: string): Promise<boolean> => {
  const expected = await hmacSign(data, secret);
  return expected === signature;
};

export type TokenPayload = Record<string, unknown> & {
  iat?: number;
  exp?: number;
};

export const sign = async (payload: TokenPayload, secret: string, opts?: { expiresIn?: number }): Promise<string> => {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    ...(opts?.expiresIn ? { exp: now + opts.expiresIn } : {}),
  };
  const headerB64 = base64url.encode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url.encode(encoder.encode(JSON.stringify(fullPayload)));
  const signature = await hmacSign(`${headerB64}.${payloadB64}`, secret);
  return `${headerB64}.${payloadB64}.${signature}`;
};

export const verify = async (token: string, secret: string): Promise<TokenPayload> => {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");
  const [header, payload, signature] = parts as [string, string, string];
  const valid = await hmacVerify(`${header}.${payload}`, signature, secret);
  if (!valid) throw new Error("Invalid token signature");
  const decoded = JSON.parse(decoder.decode(base64url.decode(payload))) as TokenPayload;
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }
  return decoded;
};
