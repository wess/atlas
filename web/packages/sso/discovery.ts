import type { DiscoveryDoc } from "./types.ts";

type CacheEntry = {
  readonly fetchedAt: number;
  readonly doc: DiscoveryDoc;
  readonly jwks: { readonly keys: readonly Record<string, unknown>[] };
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

/**
 * Fetch and cache the IdP's OIDC discovery document plus its JWKS. Cache
 * lives one hour per issuer; force-refresh by calling `clearDiscoveryCache`.
 */
export const discover = async (issuerUrl: string): Promise<CacheEntry> => {
  const key = issuerUrl.replace(/\/+$/, "");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;

  const docRes = await fetch(`${key}/.well-known/openid-configuration`, {
    headers: { accept: "application/json" },
  });
  if (!docRes.ok) {
    throw new Error(`SSO discovery failed at ${key}: HTTP ${docRes.status}`);
  }
  const doc = (await docRes.json()) as DiscoveryDoc;
  const jwksRes = await fetch(doc.jwks_uri, { headers: { accept: "application/json" } });
  if (!jwksRes.ok) {
    throw new Error(`SSO JWKS fetch failed at ${doc.jwks_uri}: HTTP ${jwksRes.status}`);
  }
  const jwks = (await jwksRes.json()) as { keys: Record<string, unknown>[] };

  const entry: CacheEntry = { fetchedAt: Date.now(), doc, jwks };
  cache.set(key, entry);
  return entry;
};

/**
 * Refresh the cached discovery + JWKS for an issuer on the next call. Useful
 * after an `kid` mismatch (the IdP rotated keys mid-window).
 */
export const clearDiscoveryCache = (issuerUrl?: string): void => {
  if (!issuerUrl) {
    cache.clear();
    return;
  }
  cache.delete(issuerUrl.replace(/\/+$/, ""));
};
