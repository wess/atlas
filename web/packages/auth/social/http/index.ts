import type { TokenSet } from "../providers/index.ts";

export const buildQuery = (params: Record<string, string | undefined>): string => {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) usp.set(k, v);
  }
  return usp.toString();
};

export const postForm = async (url: string, body: Record<string, string>, headers: Record<string, string> = {}) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", ...headers },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OAuth token endpoint ${url} returned ${res.status}: ${text.slice(0, 240)}`);
  }
  return (await res.json()) as Record<string, unknown>;
};

export const getJson = async <T = Record<string, unknown>>(
  url: string,
  headers: Record<string, string> = {},
): Promise<T> => {
  const res = await fetch(url, { headers: { accept: "application/json", ...headers } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OAuth profile endpoint ${url} returned ${res.status}: ${text.slice(0, 240)}`);
  }
  return (await res.json()) as T;
};

export const toTokenSet = (raw: Record<string, unknown>): TokenSet => ({
  accessToken: String(raw.access_token ?? ""),
  tokenType: typeof raw.token_type === "string" ? raw.token_type : undefined,
  expiresIn: typeof raw.expires_in === "number" ? raw.expires_in : undefined,
  refreshToken: typeof raw.refresh_token === "string" ? raw.refresh_token : undefined,
  idToken: typeof raw.id_token === "string" ? raw.id_token : undefined,
  scope: typeof raw.scope === "string" ? raw.scope : undefined,
  raw,
});

/**
 * Parse the unverified payload of a JWT id_token. The provider's TLS-protected
 * response already authenticates the claims for our purposes (we got them from
 * the issuer directly over a server-to-server call). Use this for OIDC userinfo;
 * do not use it to make authorization decisions on tokens that arrived through
 * the user agent.
 */
export const decodeIdTokenPayload = (idToken: string): Record<string, unknown> => {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed id_token: expected three dot-separated segments.");
  const payloadSegment = parts[1] as string;
  const json = Buffer.from(payloadSegment, "base64url").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
};
