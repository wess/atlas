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

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const hmacVerify = async (data: string, signature: string, secret: string): Promise<boolean> => {
  const expected = await hmacSign(data, secret);
  return constantTimeEqual(expected, signature);
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
  if (parts.length !== 3)
    throw new Error(
      "Invalid token format. Expected a JWT with three dot-separated base64 segments (header.payload.signature).",
    );
  const [header, payload, signature] = parts as [string, string, string];
  const valid = await hmacVerify(`${header}.${payload}`, signature, secret);
  if (!valid)
    throw new Error(
      "Invalid token signature. The token was signed with a different secret. Verify that AUTH_SECRET matches between token creation and verification.",
    );
  const decoded = JSON.parse(decoder.decode(base64url.decode(payload))) as TokenPayload;
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired. The token's exp claim is in the past. Issue a new token via the login endpoint.");
  }
  return decoded;
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
  oth?: unknown[];
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

const importPrivate = (jwk: Jwk): Promise<CryptoKey> =>
  // DOM's JsonWebKey type shape differs slightly from our Jwk — runtime
  // is identical, just appease TS.
  crypto.subtle.importKey("jwk", jwk as any, RSA_PARAMS, false, ["sign"]);

const importPublic = (jwk: Jwk): Promise<CryptoKey> =>
  crypto.subtle.importKey("jwk", jwk as any, RSA_PARAMS, false, ["verify"]);

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
    ...(opts?.expiresIn ? { exp: now + opts.expiresIn } : {}),
  };
  const headerB64 = base64url.encode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url.encode(encoder.encode(JSON.stringify(fullPayload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const cryptoKey = await importPrivate(key.privateJwk);
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
  const headerJson = JSON.parse(decoder.decode(base64url.decode(headerB64))) as { alg?: string; kid?: string };
  if (headerJson.alg !== "RS256") {
    throw new Error(`Unsupported alg: ${headerJson.alg ?? "(missing)"} — verifier only accepts RS256`);
  }
  const candidates = headerJson.kid ? jwks.keys.filter((k) => k.kid === headerJson.kid) : jwks.keys;
  if (candidates.length === 0) {
    throw new Error(`No JWKS key matches kid=${headerJson.kid ?? "(none)"}`);
  }
  const signingInput = encoder.encode(`${headerB64}.${payloadB64}`);
  const sig = base64url.decode(signatureB64);
  let ok = false;
  for (const jwk of candidates) {
    const pub = await importPublic(jwk);
    // The verify overloads want BufferSource — Uint8Array satisfies it
    // structurally but TS narrows via the generic. Cast via any.
    if (await crypto.subtle.verify(RSA_PARAMS.name, pub, sig as any, signingInput as any)) {
      ok = true;
      break;
    }
  }
  if (!ok) throw new Error("Invalid RS256 signature");
  const decoded = JSON.parse(decoder.decode(base64url.decode(payloadB64))) as TokenPayload;
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }
  return decoded;
};

/**
 * Strip the private fields off a JWK so it's safe to publish in a JWKS
 * document. Returns the public half only.
 */
export const publicJwkOf = (privateJwk: Jwk): Jwk => {
  const { d: _d, p: _p, q: _q, dp: _dp, dq: _dq, qi: _qi, oth: _oth, ...pub } = privateJwk;
  return pub;
};
