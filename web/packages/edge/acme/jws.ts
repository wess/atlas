import { b64url, b64urlJson } from "./base64.ts";
import type { Jwk } from "./keys.ts";

export type JwsHeader =
  | { readonly alg: "ES256"; readonly nonce: string; readonly url: string; readonly jwk: Jwk }
  | { readonly alg: "ES256"; readonly nonce: string; readonly url: string; readonly kid: string };

export type SignedJws = {
  readonly protected: string;
  readonly payload: string;
  readonly signature: string;
};

export const signJws = async (privateKey: CryptoKey, header: JwsHeader, payload: unknown): Promise<SignedJws> => {
  const protectedB64 = b64urlJson(header);
  const payloadB64 = payload === "" ? "" : b64urlJson(payload);
  const signingInput = new TextEncoder().encode(`${protectedB64}.${payloadB64}`);
  const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, signingInput);
  return { protected: protectedB64, payload: payloadB64, signature: b64url(sigBuf) };
};
