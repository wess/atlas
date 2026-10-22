import type { DiscoveryDoc } from "./types.ts";

type CacheEntry = {
  readonly fetchedAt: number;
  readonly doc: DiscoveryDoc;
  readonly jwks: { readonly keys: readonly Record<string, unknown>[] };
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<CacheEntry>>();

const endpoint = (value: string): string => {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
  )
    throw new Error("OIDC endpoints must use HTTPS (HTTP is allowed on loopback)");
  return value;
};

const fetchDiscovery = async (issuer: string, key: string): Promise<CacheEntry> => {
  const docRes = await fetch(endpoint(`${key}/.well-known/openid-configuration`), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
  });
  if (!docRes.ok) throw new Error(`SSO discovery failed: HTTP ${docRes.status}`);
  const doc = (await docRes.json()) as DiscoveryDoc;
  if (doc.issuer !== issuer) throw new Error("OIDC discovery issuer mismatch");
  endpoint(doc.authorization_endpoint);
  endpoint(doc.token_endpoint);
  const jwksRes = await fetch(endpoint(doc.jwks_uri), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
  });
  if (!jwksRes.ok) throw new Error(`SSO JWKS fetch failed: HTTP ${jwksRes.status}`);
  const jwks = (await jwksRes.json()) as { keys: Record<string, unknown>[] };
  if (!Array.isArray(jwks.keys) || jwks.keys.length > 100 || jwks.keys.some((k) => !k || typeof k !== "object")) {
    throw new Error("Invalid OIDC JWKS");
  }
  return { fetchedAt: Date.now(), doc, jwks };
};

export const discover = async (issuerUrl: string): Promise<CacheEntry> => {
  const cached = cache.get(issuerUrl);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
  const existing = pending.get(issuerUrl);
  if (existing) return existing;
  if (pending.size >= 64) throw new Error("Too many OIDC discovery requests");
  const promise = fetchDiscovery(issuerUrl, issuerUrl.replace(/\/+$/, ""));
  pending.set(issuerUrl, promise);
  try {
    const entry = await promise;
    // a cache clear while fetching must also invalidate the pending result
    if (pending.get(issuerUrl) === promise) {
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      cache.set(issuerUrl, entry);
    }
    return entry;
  } finally {
    if (pending.get(issuerUrl) === promise) pending.delete(issuerUrl);
  }
};

export const clearDiscoveryCache = (issuerUrl?: string): void => {
  if (!issuerUrl) {
    cache.clear();
    pending.clear();
  } else {
    cache.delete(issuerUrl);
    pending.delete(issuerUrl);
  }
};
