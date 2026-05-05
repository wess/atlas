import { b64url } from "./base64.ts";

export type Jwk = {
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  d?: string;
  [k: string]: unknown;
};

export type AcmeKeyPair = {
  readonly publicKey: CryptoKey;
  readonly privateKey: CryptoKey;
  readonly jwk: Jwk;
};

const ALG = { name: "ECDSA", namedCurve: "P-256" } as const;

export const generateKeyPair = async (): Promise<AcmeKeyPair> => {
  const pair = await crypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
  const jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as unknown as Jwk;
  return { publicKey: pair.publicKey, privateKey: pair.privateKey, jwk };
};

export const importKeyPair = async (jwk: Jwk): Promise<AcmeKeyPair> => {
  const privateKey = await crypto.subtle.importKey("jwk", jwk as never, ALG, true, ["sign"]);
  const pubJwk: Jwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  const publicKey = await crypto.subtle.importKey("jwk", pubJwk as never, ALG, true, ["verify"]);
  return { publicKey, privateKey, jwk: pubJwk };
};

export const exportJwkFull = async (key: CryptoKey): Promise<Jwk> =>
  (await crypto.subtle.exportKey("jwk", key)) as unknown as Jwk;

const canonicalJwk = (jwk: Jwk): string => JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });

export const jwkThumbprint = async (jwk: Jwk): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJwk(jwk)));
  return b64url(digest);
};
