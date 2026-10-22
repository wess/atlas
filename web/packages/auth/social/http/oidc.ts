import { type Jwks, type TokenPayload, verifyRs256 } from "../../token/index.ts";

const keys = new Map<string, { expires: number; refreshed: number; value: Promise<Jwks> }>();

const jwksFor = (url: string, refresh = false): Promise<Jwks> => {
  const cached = keys.get(url);
  if (cached && cached.expires > Date.now() && (!refresh || Date.now() - cached.refreshed < 30_000))
    return cached.value;
  if (keys.size >= 16) keys.delete(keys.keys().next().value!);
  const load = async (): Promise<Jwks> => {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "error" });
    if (!res.ok) throw new Error("Unable to load provider signing keys");
    const value = (await res.json()) as Jwks;
    if (
      !Array.isArray(value.keys) ||
      value.keys.length > 100 ||
      value.keys.some((key) => !key || typeof key !== "object")
    ) {
      throw new Error("Invalid provider signing keys");
    }
    return value;
  };
  const value = load();
  const entry = { expires: Date.now() + 60 * 60 * 1000, refreshed: refresh ? Date.now() : 0, value };
  keys.set(url, entry);
  void value.catch(() => {
    if (keys.get(url) === entry) keys.delete(url);
  });
  return value;
};

export const verifyIdToken = async (
  token: string,
  clientId: string,
  jwksUrl: string,
  issuer: (claims: TokenPayload) => boolean,
): Promise<TokenPayload> => {
  let jwks = await jwksFor(jwksUrl);
  const header = token.split(".")[0];
  const decoded: unknown = header ? JSON.parse(Buffer.from(header, "base64url").toString()) : null;
  const kid = decoded && typeof decoded === "object" && "kid" in decoded ? decoded.kid : undefined;
  if (typeof kid === "string" && !jwks.keys.some((key) => key.kid === kid)) jwks = await jwksFor(jwksUrl, true);
  const claims = await verifyRs256(token, jwks);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (
    !issuer(claims) ||
    !audiences.includes(clientId) ||
    (audiences.length > 1 && claims.azp !== clientId) ||
    (claims.azp !== undefined && claims.azp !== clientId) ||
    typeof claims.exp !== "number" ||
    typeof claims.iat !== "number" ||
    typeof claims.sub !== "string" ||
    !claims.sub
  )
    throw new Error("Invalid provider id_token claims");
  return claims;
};
