import { createHash, randomBytes } from "node:crypto";

const b64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/**
 * Generate a PKCE verifier + S256 challenge. The verifier stays in the
 * server-side state row; the challenge is sent to the IdP and matched on
 * the way back. RFC 7636 §4.
 */
export const newPkcePair = (): { readonly verifier: string; readonly challenge: string } => {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
};

export const randomState = (): string => b64url(randomBytes(24));

export const randomNonce = (): string => b64url(randomBytes(24));
