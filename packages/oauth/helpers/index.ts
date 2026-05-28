import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Spec-compliant base64url (no padding, +/_-). */
const b64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** URL-safe random identifier. Default 32 bytes (~43 chars). */
export const randomId = (bytes = 32): string => b64url(randomBytes(bytes));

/** Short, displayable identifier suitable for `client_id`. */
export const shortId = (prefix = "cli"): string => `${prefix}_${randomBytes(12).toString("hex")}`;

/** Verify a PKCE S256 challenge against the verifier the client sends back. */
export const verifyPkceS256 = (verifier: string, challenge: string): boolean => {
  if (typeof verifier !== "string" || verifier.length < 43 || verifier.length > 128) return false;
  const hashed = b64url(createHash("sha256").update(verifier).digest());
  if (hashed.length !== challenge.length) return false;
  try {
    return timingSafeEqual(Buffer.from(hashed), Buffer.from(challenge));
  } catch {
    return false;
  }
};

/** Hex SHA-256 — used to hash refresh tokens and client secrets at rest. */
export const sha256 = (input: string): string => createHash("sha256").update(input).digest("hex");

/** Constant-time comparison of two hex SHA-256 digests. */
export const sha256Equal = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  try {
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
};

export const parseScope = (raw: string | undefined | null): readonly string[] => {
  if (!raw) return [];
  return raw.split(/\s+/).filter((s) => s.length > 0);
};

export const formatScope = (scopes: readonly string[]): string => scopes.join(" ");

/**
 * Subset check — true if every scope in `requested` is in `allowed`. Used for
 * grant validation and per-request scope guards.
 */
export const includesScopes = (allowed: readonly string[], requested: readonly string[]): boolean =>
  requested.every((s) => allowed.includes(s));

/**
 * Exact-string `redirect_uri` match per OAuth 2.0 Security BCP. Substring or
 * prefix matching is the source of countless open-redirect CVEs — never accept
 * either.
 */
export const isAllowedRedirect = (requested: string, allowed: readonly string[]): boolean =>
  allowed.some((uri) => uri === requested);

// User-friendly alphabet for device-flow user_codes — no I/L/O/0/1 to avoid
// confusables on a hand-typed code. 31 chars × 8 positions = ~9.5e11 codes.
const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Random 4-4 user code suitable for the device-authorization flow. */
export const newUserCode = (): string => {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += USER_CODE_ALPHABET[bytes[i]! % USER_CODE_ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
};

/** Strip whitespace + dashes, uppercase, then re-insert the dash. */
export const normalizeUserCode = (input: string): string => {
  const stripped = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (stripped.length !== 8) return stripped;
  return `${stripped.slice(0, 4)}-${stripped.slice(4)}`;
};

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const AUTH_CODE_TTL_SECONDS = 60; // 1 minute
export const DEVICE_CODE_TTL_SECONDS = 60 * 10; // 10 minutes
export const DEVICE_POLL_INTERVAL_SECONDS = 5;
export const ID_TOKEN_TTL_SECONDS = 60 * 10; // 10 minutes — short, RPs use sessions

export const issuerFromRequest = (req: Request): string => {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
};

export const hasOpenIdScope = (scope: string): boolean =>
  parseScope(scope).includes("openid");
