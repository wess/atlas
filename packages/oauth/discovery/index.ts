import type { Route } from "@atlas/server";
import { get, json } from "@atlas/server";
import type { OAuthConfig } from "../types.ts";

const issuerFromRequest = (req: Request): string => {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
};

/**
 * RFC 8414 — OAuth 2.0 Authorization Server Metadata. The `issuer` is derived
 * from the request URL so the same binary works behind any host. Override the
 * advertised endpoint paths via `basePath` if your app mounts them
 * non-standard locations.
 */
export const oauthDiscoveryRoutes = (cfg: OAuthConfig, basePath = "/oauth"): readonly Route[] => [
  get("/.well-known/oauth-authorization-server", async (c) => {
    const issuer = issuerFromRequest(c.request);
    return json(c, 200, {
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
    });
  }),
];
