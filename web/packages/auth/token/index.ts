const encoder = new TextEncoder();
const decoder = new TextDecoder();

const base64url = {
  encode: (data: Uint8Array): string => Buffer.from(data).toString("base64url"),
  decode: (str: string): Uint8Array => new Uint8Array(Buffer.from(str, "base64url")),
};

const hmacKeys = new Map<string, Promise<CryptoKey>>();
const hmacKey = (secret: string): Promise<CryptoKey> => {
  if (!secret) throw new Error("Token secret must not be empty");
  const cached = hmacKeys.get(secret);
  if (cached) return cached;
  if (hmacKeys.size >= 32) hmacKeys.delete(hmacKeys.keys().next().value!);
  const key = crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
  hmacKeys.set(secret, key);
  return key;
};

const hmacSign = async (data: string, secret: string): Promise<string> => {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(data));
  return base64url.encode(new Uint8Array(sig));
};

const signatureBytes = (signature: string): Buffer<ArrayBuffer> => {
  const bytes = Buffer.from(signature, "base64url");
  if (!signature || bytes.toString("base64url") !== signature) throw new Error("Invalid token signature encoding");
  return bytes;
};

const hmacVerify = async (data: string, signature: string, secret: string): Promise<boolean> =>
  crypto.subtle.verify("HMAC", await hmacKey(secret), signatureBytes(signature), encoder.encode(data));

const decodeObject = (segment: string): Record<string, unknown> => {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("Invalid token encoding");
  const value: unknown = JSON.parse(decoder.decode(base64url.decode(segment)));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid token claims");
  return value as Record<string, unknown>;
};

const validateClaims = (decoded: Record<string, unknown>): TokenPayload => {
  const now = Math.floor(Date.now() / 1000);
  for (const claim of ["exp", "nbf", "iat"]) {
    const value = decoded[claim];
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`Invalid token ${claim} claim`);
    }
  }
  if (typeof decoded.exp === "number" && decoded.exp <= now) throw new Error("Token expired");
  if (typeof decoded.nbf === "number" && decoded.nbf > now) throw new Error("Token not active");
  return decoded as TokenPayload;
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
    ...(opts?.expiresIn !== undefined ? { exp: now + opts.expiresIn } : {}),
  };
  const headerB64 = base64url.encode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url.encode(encoder.encode(JSON.stringify(fullPayload)));
  const signature = await hmacSign(`${headerB64}.${payloadB64}`, secret);
  return `${headerB64}.${payloadB64}.${signature}`;
};

export const verify = async (token: string, secret: string): Promise<TokenPayload> => {
  const parts = token.split(".");
  if (parts.length !== 3)
    throw new Error(
      "Invalid token format. Expected a JWT with three dot-separated base64 segments (header.payload.signature).",
    );
  const [header, payload, signature] = parts as [string, string, string];
  if (decodeObject(header).alg !== "HS256") throw new Error("Unsupported token algorithm");
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) throw new Error("Invalid token signature");
  const valid = await hmacVerify(`${header}.${payload}`, signature, secret);
  if (!valid)
    throw new Error(
      "Invalid token signature. The token was signed with a different secret. Verify that AUTH_SECRET matches between token creation and verification.",
    );
  return validateClaims(decodeObject(payload));
};

// RS256 — asymmetric JWT signing for cases where verifiers can't share the
// signing key. OIDC id_tokens are the headline use case: any relying party
// can verify a token by fetching the issuer's JWKS, no shared secret.

/**
 * JWK shape — covers the fields we read or write. Matches the Web Crypto
 * `JsonWebKey` interface; declared locally so Atlas doesn't have to pull
 * in DOM types just for this package.
 */
export type Jwk = {
  kty?: string;
  use?: string;
  key_ops?: string[];
  alg?: string;
  kid?: string;
  ext?: boolean;
  // RSA-specific fields
  n?: string;
  e?: string;
  d?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
  oth?: { r?: string; d?: string; t?: string }[];
};

export type Rs256KeyPair = {
  readonly kid: string;
  readonly publicJwk: Jwk;
  readonly privateJwk: Jwk;
};

const RSA_PARAMS = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
} as const;

const RSA_GEN_PARAMS = {
  ...RSA_PARAMS,
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
} as const;

/** Generate an RSA-2048 signing keypair and a stable `kid` for it. */
export const generateRs256KeyPair = async (): Promise<Rs256KeyPair> => {
  const pair = await crypto.subtle.generateKey(RSA_GEN_PARAMS, true, ["sign", "verify"]);
  const publicJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as Jwk;
  const privateJwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as Jwk;
  // kid = base64url(SHA-256(n)) of the modulus. Stable across re-imports of
  // the same key. Relying parties cache by kid, so this stays consistent.
  const kid = await jwkThumbprint(publicJwk);
  return { kid, publicJwk: { ...publicJwk, kid, alg: "RS256", use: "sig" }, privateJwk: { ...privateJwk, kid } };
};

const jwkThumbprint = async (jwk: Jwk): Promise<string> => {
  // RFC 7638 §3.2 — canonical form is just {e, kty, n} for RSA, lex-sorted,
  // no whitespace. Hash with SHA-256 and base64url-encode.
  const canonical = JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n });
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(canonical));
  return base64url.encode(new Uint8Array(hash));
};

const privateKeys = new WeakMap<Jwk, Promise<CryptoKey>>();
const publicKeys = new WeakMap<Jwk, Promise<CryptoKey>>();
const importRsa = (jwk: Jwk, usage: "sign" | "verify"): Promise<CryptoKey> => {
  const keys = usage === "sign" ? privateKeys : publicKeys;
  const cached = keys.get(jwk);
  if (cached) return cached;
  const key = crypto.subtle.importKey("jwk", jwk, RSA_PARAMS, false, [usage]);
  keys.set(jwk, key);
  return key;
};

export const signRs256 = async (
  payload: TokenPayload,
  key: { kid: string; privateJwk: Jwk },
  opts?: { expiresIn?: number },
): Promise<string> => {
  const header = { alg: "RS256", typ: "JWT", kid: key.kid };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    ...(opts?.expiresIn !== undefined ? { exp: now + opts.expiresIn } : {}),
  };
  const headerB64 = base64url.encode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url.encode(encoder.encode(JSON.stringify(fullPayload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const cryptoKey = await importRsa(key.privateJwk, "sign");
  const sig = await crypto.subtle.sign(RSA_PARAMS.name, cryptoKey, encoder.encode(signingInput));
  return `${signingInput}.${base64url.encode(new Uint8Array(sig))}`;
};

export type Jwks = { readonly keys: readonly Jwk[] };

/**
 * Verify an RS256-signed JWT against a JWKS. The token's header.kid is
 * matched against the JWKS; if no key matches, the verifier tries every key
 * in the set (slow path for JWKs without `kid`). Throws on signature
 * failure, malformed token, or expired `exp`.
 */
export const verifyRs256 = async (token: string, jwks: Jwks): Promise<TokenPayload> => {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  const headerJson = decodeObject(headerB64);
  if (headerJson.alg !== "RS256") {
    throw new Error(`Unsupported alg: ${headerJson.alg ?? "(missing)"} — verifier only accepts RS256`);
  }
  const candidates = jwks.keys.filter(
    (key) =>
      (!headerJson.kid || key.kid === headerJson.kid) &&
      key.kty === "RSA" &&
      (!key.alg || key.alg === "RS256") &&
      (!key.use || key.use === "sig") &&
      (!key.key_ops || key.key_ops.includes("verify")),
  );
  if (candidates.length === 0) {
    throw new Error(`No JWKS key matches kid=${headerJson.kid ?? "(none)"}`);
  }
  const signingInput = encoder.encode(`${headerB64}.${payloadB64}`);
  const sig = signatureBytes(signatureB64);
  let ok = false;
  for (const jwk of candidates) {
    const pub = await importRsa(jwk, "verify");
    // The verify overloads want BufferSource — Uint8Array satisfies it
    // structurally but TS narrows via the generic. Cast via any.
    if (await crypto.subtle.verify(RSA_PARAMS.name, pub, Buffer.from(sig), Buffer.from(signingInput))) {
      ok = true;
      break;
    }
  }
  if (!ok) throw new Error("Invalid RS256 signature");
  return validateClaims(decodeObject(payloadB64));
};

/**
 * Strip the private fields off a JWK so it's safe to publish in a JWKS
 * document. Returns the public half only.
 */
export const publicJwkOf = (privateJwk: Jwk): Jwk => {
  const { d: _d, p: _p, q: _q, dp: _dp, dq: _dq, qi: _qi, oth: _oth, ...pub } = privateJwk;
  return pub;
};
