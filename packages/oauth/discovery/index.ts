import type { Route } from "@atlas/server";
import { get, json } from "@atlas/server";
import { issuerFromRequest } from "../helpers";
import type { OAuthConfig } from "../types.ts";

const metadata = (cfg: OAuthConfig, basePath: string, issuer: string) => {
  const base: Record<string, unknown> = {
    issuer,
    authorization_endpoint: `${issuer}${basePath}/authorize`,
    token_endpoint: `${issuer}${basePath}/token`,
    revocation_endpoint: `${issuer}${basePath}/revoke`,
    device_authorization_endpoint: `${issuer}${basePath}/device/authorize`,
    scopes_supported: cfg.scopes,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:device_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post"],
  };
  if (cfg.openid) {
    // OIDC discovery additions. RPs read this to wire themselves up.
    base.userinfo_endpoint = `${issuer}${basePath}/userinfo`;
    base.jwks_uri = `${issuer}${basePath}/jwks`;
    base.end_session_endpoint = `${issuer}${basePath}/end_session`;
    base.id_token_signing_alg_values_supported = ["RS256"];
    base.subject_types_supported = ["public"];
    const scopes = base.scopes_supported as readonly string[];
    if (!scopes.includes("openid")) {
      base.scopes_supported = ["openid", ...scopes];
    }
    base.claims_supported = ["sub", "email", "email_verified", "name", "preferred_username", "picture"];
    base.backchannel_logout_supported = true;
    base.backchannel_logout_session_supported = false;
  }
  return base;
};

/**
 * RFC 8414 OAuth + OIDC Discovery. Same payload served at both well-known
 * paths so RPs that pick one or the other both work. `issuer` derives from
 * the request URL so the same binary works behind any host.
 */
export const oauthDiscoveryRoutes = (cfg: OAuthConfig, basePath = "/oauth"): readonly Route[] => {
  const routes: Route[] = [
    get("/.well-known/oauth-authorization-server", async (c) =>
      json(c, 200, metadata(cfg, basePath, issuerFromRequest(c.request))),
    ),
  ];
  if (cfg.openid) {
    routes.push(
      get("/.well-known/openid-configuration", async (c) =>
        json(c, 200, metadata(cfg, basePath, issuerFromRequest(c.request))),
      ),
    );
  }
  return routes;
};
