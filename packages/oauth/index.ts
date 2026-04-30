import type { Route } from "@atlas/server";
import { oauthAuthorizeRoutes } from "./authorize";
import { oauthClientRoutes } from "./clients";
import { oauthDeviceRoutes } from "./device";
import { oauthDiscoveryRoutes } from "./discovery";
import { oauthRevokeRoutes } from "./revoke";
import { oauthTokenRoutes } from "./token";
import type { OAuthConfig } from "./types";

export { oauthAuthorizeRoutes } from "./authorize";
export { findClient, oauthClientRoutes, verifyClientCredentials } from "./clients";
export { oauthDeviceRoutes } from "./device";
export { oauthDiscoveryRoutes } from "./discovery";
export {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  DEVICE_CODE_TTL_SECONDS,
  DEVICE_POLL_INTERVAL_SECONDS,
  formatScope,
  includesScopes,
  isAllowedRedirect,
  newUserCode,
  normalizeUserCode,
  parseScope,
  REFRESH_TOKEN_TTL_SECONDS,
  randomId,
  sha256,
  shortId,
  verifyPkceS256,
} from "./helpers";
export { oauthRevokeRoutes } from "./revoke";
export {
  sweepExpired,
  sweepExpiredAuthCodes,
  sweepExpiredDeviceCodes,
  sweepExpiredRefreshTokens,
} from "./sweep";
export { oauthTokenRoutes } from "./token";
export type {
  AuthCodeRow,
  ClientRow,
  DeviceCodeRow,
  OAuthAuditEvent,
  OAuthConfig,
  OAuthUser,
  RefreshTokenRow,
  RequestContext,
} from "./types";

/**
 * Convenience: returns every route the OAuth server publishes — authorize +
 * token + revoke + device + discovery + admin clients — as a single flat list
 * ready for `serve` / `compose`. Call it once and spread the result into your
 * route table.
 *
 * If you want to mount a subset (e.g. skip device flow), call the individual
 * `oauthXxxRoutes(cfg)` factories directly instead.
 */
export const oauthRoutes = (
  cfg: OAuthConfig,
  opts: {
    /** Path prefix for all OAuth endpoints. Default: `/oauth`. */
    readonly basePath?: string;
    /** Path prefix for the admin client-management routes. Default: `/admin/oauth`. */
    readonly adminBasePath?: string;
  } = {},
): readonly Route[] => {
  const basePath = opts.basePath ?? "/oauth";
  const adminBasePath = opts.adminBasePath ?? "/admin/oauth";
  return [
    ...oauthAuthorizeRoutes(cfg, basePath),
    ...oauthTokenRoutes(cfg, basePath),
    ...oauthRevokeRoutes(cfg, basePath),
    ...oauthDeviceRoutes(cfg, basePath),
    ...oauthDiscoveryRoutes(cfg, basePath),
    ...oauthClientRoutes(cfg, adminBasePath),
  ];
};
