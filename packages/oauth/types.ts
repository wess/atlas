import type { Connection } from "@atlas/db";
import type { PipeFn } from "@atlas/server";

/**
 * The user record loaded by `loadUser` when a grant succeeds. The library
 * doesn't peek inside — whatever you return is passed straight to
 * `buildAccessTokenClaims` to become the JWT payload.
 */
export type OAuthUser = { readonly id: number | string; readonly [k: string]: unknown };

export type OAuthAuditEvent = {
  readonly userId?: number | string | null;
  readonly event: string;
  readonly metadata?: Record<string, unknown>;
  readonly ip?: string | null;
  readonly userAgent?: string | null;
};

/** Anything shaped like `@atlas/security`'s `AuditLogger.log`. */
export type AuditLog = (ev: OAuthAuditEvent) => void;

/**
 * Tag derived from the request: caller IP and user-agent. Stamped onto every
 * audit event the package emits. Wire this to `clientIp` / `userAgent` from
 * `@atlas/security` when you want trusted-proxy handling.
 */
export type RequestContext = (req: Request) => { readonly ip?: string | null; readonly userAgent?: string | null };

/** Top-level config every route factory consumes. */
export type OAuthConfig = {
  readonly db: Connection;
  /** JWT signing secret. */
  readonly secret: string;
  /** Scopes the server is willing to grant. */
  readonly scopes: readonly string[];
  /**
   * Look up a user given the ID stored on an authorization or device code.
   * Return null if the account no longer exists — the grant fails with
   * `invalid_grant`.
   */
  readonly loadUser: (db: Connection, userId: number | string) => Promise<OAuthUser | null>;
  /**
   * Build the claims placed inside an access-token JWT. The library merges in
   * `{ client_id, scope, jti }` regardless of what you return.
   */
  readonly buildAccessTokenClaims: (user: OAuthUser) => Record<string, unknown>;
  /**
   * PipeFn that authenticates the currently signed-in user hitting the
   * consent screen — the GET /authorize/info, POST /authorize/{approve,deny},
   * and POST /device/{approve,deny} endpoints. Typically `requireAuth({
   * secret })` from `@atlas/auth`.
   */
  readonly requireUser: PipeFn;
  /**
   * PipeFn that gates the admin client-management routes (under
   * `adminBasePath`, default `/admin/oauth/clients`). Compose `requireUser`
   * with whatever owner / permissions check your app uses.
   */
  readonly requireAdmin: PipeFn;
  /** Where to read the authenticated user's ID off `conn.assigns`. Default: `auth.id`. */
  readonly userIdFromConn?: (conn: { readonly assigns: Record<string, unknown> }) => number | string;
  /** Optional audit hook — every issuance / revocation routes through it. */
  readonly audit?: AuditLog;
  /** How to derive the request context for audit events. Defaults to `{}`. */
  readonly requestContext?: RequestContext;
  /** Override table names if your schema diverges. */
  readonly tables?: {
    readonly clients?: string;
    readonly authorizationCodes?: string;
    readonly refreshTokens?: string;
    readonly deviceCodes?: string;
  };
  /**
   * Build the `verification_uri` returned from the device-authorize endpoint.
   * Default: `${origin}/pair`.
   */
  readonly buildVerificationUri?: (req: Request) => string;
};

/** Resolved internal table-name map. */
export type Tables = {
  readonly clients: string;
  readonly authorizationCodes: string;
  readonly refreshTokens: string;
  readonly deviceCodes: string;
};

export const resolveTables = (cfg: OAuthConfig): Tables => ({
  clients: cfg.tables?.clients ?? "oauth_clients",
  authorizationCodes: cfg.tables?.authorizationCodes ?? "oauth_authorization_codes",
  refreshTokens: cfg.tables?.refreshTokens ?? "oauth_refresh_tokens",
  deviceCodes: cfg.tables?.deviceCodes ?? "oauth_device_codes",
});

export const authIdOf =
  (cfg: OAuthConfig) =>
  (conn: { readonly assigns: Record<string, unknown> }): number | string => {
    if (cfg.userIdFromConn) return cfg.userIdFromConn(conn);
    const auth = conn.assigns.auth as { id?: number | string } | undefined;
    if (!auth || auth.id === undefined || auth.id === null) {
      throw new Error("requireUser produced no auth.id — set userIdFromConn or fix your guard");
    }
    return auth.id;
  };

export const ctxOf =
  (cfg: OAuthConfig) =>
  (req: Request): { readonly ip?: string | null; readonly userAgent?: string | null } =>
    cfg.requestContext ? cfg.requestContext(req) : {};

export const logAudit = (cfg: OAuthConfig, ev: OAuthAuditEvent): void => {
  if (cfg.audit) cfg.audit(ev);
};

export type ClientRow = {
  readonly id: number;
  readonly client_id: string;
  readonly client_secret_hash: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly icon_url: string | null;
  readonly redirect_uris: string;
  readonly allowed_scopes: string;
  readonly is_official: boolean;
  readonly created_at: string;
  readonly revoked_at: string | null;
};

export type AuthCodeRow = {
  readonly code: string;
  readonly client_id: string;
  readonly user_id: number | string;
  readonly redirect_uri: string;
  readonly code_challenge: string;
  readonly scope: string;
  readonly expires_at: string;
  readonly used_at: string | null;
};

export type RefreshTokenRow = {
  readonly token_hash: string;
  readonly client_id: string;
  readonly user_id: number | string;
  readonly scope: string;
  readonly parent_token_hash: string | null;
  readonly expires_at: string;
  readonly revoked_at: string | null;
};

export type DeviceCodeRow = {
  readonly device_code: string;
  readonly user_code: string;
  readonly client_id: string;
  readonly scope: string;
  readonly user_id: number | string | null;
  readonly approved_at: string | null;
  readonly denied_at: string | null;
  readonly last_polled_at: string | null;
  readonly expires_at: string;
};
