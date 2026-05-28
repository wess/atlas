import type { Route } from "../../server/index.ts";
import { get, json } from "../../server/index.ts";
import type { OAuthConfig } from "../types.ts";

/**
 * OIDC `/oauth/jwks` — publishes the public keys relying parties use to
 * verify id_tokens and logout_tokens. Cache-friendly: RPs typically poll
 * once and cache by `kid`. Only mounts when OIDC is enabled.
 */
export const oauthJwksRoutes = (cfg: OAuthConfig, basePath = "/oauth"): readonly Route[] => {
  if (!cfg.openid) return [];
  const oidc = cfg.openid;

  return [
    get(`${basePath}/jwks`, async (c) => {
      const jwks = await oidc.jwks();
      const out = json(c, 200, jwks);
      // Rotation is rare and clients re-fetch on unknown-kid sig failures.
      out.respHeaders.set("cache-control", "public, max-age=3600");
      return out;
    }),
  ];
};
