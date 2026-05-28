import { token as jwt } from "../../auth/index.ts";
import { ID_TOKEN_TTL_SECONDS, randomId } from "../helpers";
import type { OAuthUser, OidcConfig } from "../types.ts";

/**
 * Mint an OIDC id_token (RS256) for a successful grant. Caller is
 * responsible for checking that the grant included the `openid` scope —
 * this function unconditionally signs.
 */
export const signIdToken = async (
  oidc: OidcConfig,
  user: OAuthUser,
  params: {
    readonly issuer: string;
    readonly audience: string;
    readonly nonce?: string;
    readonly authTime?: number;
  },
): Promise<string> => {
  const ttl = oidc.idTokenTtlSeconds ?? ID_TOKEN_TTL_SECONDS;
  const claims = oidc.buildIdTokenClaims(user);
  // sub must be a string per spec. Cast late so callers can return numeric IDs.
  const sub = String(claims.sub ?? user.id);
  const payload: Record<string, unknown> = {
    ...claims,
    sub,
    iss: params.issuer,
    aud: params.audience,
    jti: randomId(16),
  };
  if (params.nonce) payload.nonce = params.nonce;
  if (params.authTime) payload.auth_time = params.authTime;
  return jwt.signRs256(payload, oidc.signingKey, { expiresIn: ttl });
};

/**
 * Mint an OIDC back-channel logout_token. Spec: OIDC Back-Channel Logout 1.0.
 * Notably the token MUST NOT carry a `nonce` (spec §2.6) and MUST contain
 * the `events` claim with the back-channel-logout URI as the key.
 */
export const signLogoutToken = async (
  oidc: OidcConfig,
  params: {
    readonly issuer: string;
    readonly audience: string;
    readonly sub: string;
    readonly sid?: string;
  },
): Promise<string> => {
  const payload: Record<string, unknown> = {
    iss: params.issuer,
    aud: params.audience,
    sub: params.sub,
    jti: randomId(16),
    events: { "http://schemas.openid.net/event/backchannel-logout": {} },
  };
  if (params.sid) payload.sid = params.sid;
  // 2-minute lifetime is generous; logout doesn't need long-lived tokens.
  return jwt.signRs256(payload, oidc.signingKey, { expiresIn: 120 });
};
