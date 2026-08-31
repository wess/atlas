import { token as jwt } from "../../auth/index.ts";
import type { Route } from "../../server/index.ts";
import { get, halt, json } from "../../server/index.ts";
import { hasOpenIdScope } from "../helpers";
import type { OAuthConfig } from "../types.ts";

/**
 * OIDC `/oauth/userinfo` — the relying party calls this with a Bearer
 * access_token to retrieve the user's identity claims. Only mounts when
 * OIDC is enabled. Tokens that lack the `openid` scope are rejected
 * (insufficient_scope per spec §5.3.3).
 */
export const oauthUserinfoRoutes = (cfg: OAuthConfig, basePath = "/oauth"): readonly Route[] => {
  if (!cfg.openid) return [];
  const oidc = cfg.openid;

  return [
    get(`${basePath}/userinfo`, async (c) => {
      const header = c.headers.get("authorization");
      if (!header?.startsWith("Bearer ")) {
        return halt(c, 401, { error: "invalid_token", error_description: "Bearer token required" });
      }
      const token = header.slice(7).trim();
      let payload: jwt.TokenPayload;
      try {
        payload = await jwt.verify(token, cfg.secret);
      } catch (err) {
        return halt(c, 401, {
          error: "invalid_token",
          error_description: err instanceof Error ? err.message : String(err),
        });
      }
      const scope = typeof payload.scope === "string" ? payload.scope : "";
      if (!hasOpenIdScope(scope)) {
        return halt(c, 403, { error: "insufficient_scope", error_description: "openid scope required" });
      }
      const userId = payload.sub ?? payload.id;
      if (userId === undefined || userId === null) {
        return halt(c, 401, { error: "invalid_token", error_description: "Token has no subject" });
      }
      const user = await cfg.loadUser(cfg.db, userId as number | string);
      if (!user) {
        return halt(c, 404, { error: "invalid_token", error_description: "User no longer exists" });
      }
      const claims = oidc.buildIdTokenClaims(user);
      return json(c, 200, { ...claims, sub: String(claims.sub ?? user.id) });
    }),
  ];
};
