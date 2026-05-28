import type { Connection } from "../db/index.ts";
import type { Conn } from "../server/index.ts";

/**
 * Claims a successful authorization yields. `sub` is required (string user
 * identifier from the IdP). Everything else is best-effort.
 */
export type IdTokenClaims = {
  readonly sub: string;
  readonly iss: string;
  readonly aud: string | readonly string[];
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly name?: string;
  readonly preferred_username?: string;
  readonly picture?: string;
  readonly [k: string]: unknown;
};

export type AuthenticatedUser = {
  /** The local user-table primary key after upsert. */
  readonly localUserId: number | string;
  /**
   * Display name surfaced in the session cookie / JWT issued by the host
   * app. Falls back to claims.name → claims.preferred_username → "user".
   */
  readonly displayName?: string;
};

/**
 * Where to send the user after a successful login. Defaults to "/".
 */
export type SessionIssuer = (
  conn: Conn,
  user: AuthenticatedUser,
  claims: IdTokenClaims,
) => Promise<Conn> | Conn;

/**
 * Configuration passed to `mountSso`. The host app supplies the issuer URL,
 * client credentials, and a callback (`onAuthenticated`) that resolves
 * incoming OIDC claims to a local user row.
 */
export type SsoConfig = {
  readonly db: Connection;
  /**
   * Base URL of the IdP — used for discovery (the relying party fetches
   * `${issuerUrl}/.well-known/openid-configuration` once at startup and
   * caches the endpoints).
   */
  readonly issuerUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  /**
   * Where the IdP should send the user-agent back after consent. Must be
   * registered on the IdP's client record. Defaults to the host app's
   * `${origin}/auth/sso/callback`, derived from the request URL.
   */
  readonly redirectUri?: string;
  /**
   * Scopes to request. `openid` is always added. Defaults to
   * `["openid", "email", "profile"]`.
   */
  readonly scopes?: readonly string[];
  /**
   * Called when the IdP returns valid claims. Implementations upsert the
   * local user row and return its primary key. Throwing aborts the login
   * with a 500 — RPs should surface the message to the user.
   */
  readonly onAuthenticated: (
    db: Connection,
    claims: IdTokenClaims,
  ) => Promise<AuthenticatedUser>;
  /**
   * Issue whatever session the host app uses (set-cookie, write to sessions
   * table, etc.) and return the Conn with the redirect-home response.
   * Typically this calls the host app's existing `issueSession` helper.
   */
  readonly issueSession: SessionIssuer;
  /**
   * Path prefix for the mounted routes. Default: `/auth/sso`.
   */
  readonly basePath?: string;
  /**
   * Default destination after login when the original request had no
   * `return_to`. Default: `/`.
   */
  readonly defaultPostLoginPath?: string;
  /**
   * Called when the IdP fans out a back-channel logout. The handler is
   * expected to revoke all sessions for `localUserId`. The library does
   * the JWT verification + sub lookup before invoking this.
   */
  readonly invalidateSessions?: (
    db: Connection,
    params: { readonly sub: string; readonly localUserId: number | string | null },
  ) => Promise<void> | void;
  /**
   * Optional: where to find a previously-upserted user by their IdP sub
   * (so back-channel logout knows which local row to invalidate). When
   * unset, the package skips local-session invalidation and just acks.
   */
  readonly findLocalUserBySub?: (
    db: Connection,
    sub: string,
  ) => Promise<number | string | null>;
  /** Override table name for the transient state store. Default: `sso_state`. */
  readonly stateTable?: string;
};

export type DiscoveryDoc = {
  readonly issuer: string;
  readonly authorization_endpoint: string;
  readonly token_endpoint: string;
  readonly jwks_uri: string;
  readonly userinfo_endpoint?: string;
  readonly end_session_endpoint?: string;
  readonly id_token_signing_alg_values_supported?: readonly string[];
};
