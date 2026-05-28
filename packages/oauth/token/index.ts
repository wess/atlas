import { token as jwt } from "../../auth/index.ts";
import type { Connection } from "../../db/index.ts";
import { from } from "../../db/index.ts";
import type { Conn, Route } from "../../server/index.ts";
import { json, parseForm, parseJson, pipeline, post } from "../../server/index.ts";
import { findClient, verifyClientCredentials } from "../clients";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  DEVICE_POLL_INTERVAL_SECONDS,
  formatScope,
  hasOpenIdScope,
  issuerFromRequest,
  parseScope,
  REFRESH_TOKEN_TTL_SECONDS,
  randomId,
  sha256,
  verifyPkceS256,
} from "../helpers";
import { signIdToken } from "../oidc";
import {
  type AuthCodeRow,
  type ClientRow,
  ctxOf,
  type DeviceCodeRow,
  logAudit,
  type OAuthConfig,
  type OAuthUser,
  type RefreshTokenRow,
  resolveTables,
  type Tables,
} from "../types.ts";

const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

const oauthError = (c: Conn, status: number, error: string, description?: string) =>
  json(c, status, description ? { error, error_description: description } : { error });

type TokenResponse = {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly token_type: "Bearer";
  readonly expires_in: number;
  readonly scope: string;
  readonly id_token?: string;
};

const issueTokens = async (
  db: Connection,
  tables: Tables,
  cfg: OAuthConfig,
  user: OAuthUser,
  clientId: string,
  scope: string,
  ctx: { readonly request: Request; readonly nonce?: string; readonly authTime?: number },
  parentTokenHash?: string,
): Promise<TokenResponse> => {
  const accessToken = await jwt.sign(
    {
      ...cfg.buildAccessTokenClaims(user),
      client_id: clientId,
      scope,
      jti: randomId(16),
    },
    cfg.secret,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
  const refreshToken = `oat_${randomId(32)}`;
  const refreshHash = sha256(refreshToken);
  await db.execute(
    from(tables.refreshTokens).insert({
      token_hash: refreshHash,
      client_id: clientId,
      user_id: user.id,
      scope,
      parent_token_hash: parentTokenHash ?? null,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
    }),
  );
  const base: TokenResponse = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    scope,
  };
  if (cfg.openid && hasOpenIdScope(scope)) {
    const id_token = await signIdToken(cfg.openid, user, {
      issuer: issuerFromRequest(ctx.request),
      audience: clientId,
      nonce: ctx.nonce,
      authTime: ctx.authTime,
    });
    return { ...base, id_token };
  }
  return base;
};

/**
 * `/oauth/token` — handles `authorization_code`, `refresh_token`, and the
 * RFC 8628 `urn:ietf:params:oauth:grant-type:device_code` grants. Accepts both
 * `application/x-www-form-urlencoded` (the spec default) and JSON.
 */
export const oauthTokenRoutes = (cfg: OAuthConfig, basePath = "/oauth"): readonly Route[] => {
  const tables = resolveTables(cfg);
  const ctx = ctxOf(cfg);
  // Both parsers are no-ops when the content-type doesn't match, so chaining
  // them is safe and lets curl users send either form.
  const parseBody = pipeline(parseJson, parseForm);

  const handleAuthorizationCode = async (c: Conn, body: Record<string, string | undefined>) => {
    const requestCtx = ctx(c.request);
    const clientId = body.client_id;
    const code = body.code;
    const codeVerifier = body.code_verifier;
    const redirectUri = body.redirect_uri;
    const clientSecret = body.client_secret;

    if (!clientId || !code || !codeVerifier || !redirectUri) {
      return oauthError(c, 400, "invalid_request", "client_id, code, code_verifier and redirect_uri are required");
    }
    const client = await findClient(cfg.db, tables.clients, clientId);
    if (!client || client.revoked_at) return oauthError(c, 400, "invalid_client", "Unknown or revoked client");
    if (!verifyClientCredentials(client, clientSecret)) {
      return oauthError(c, 401, "invalid_client", "Bad client credentials");
    }

    // Atomic single-use: only succeed if used_at was still null.
    const claimed = (await cfg.db.execute(
      from(tables.authorizationCodes)
        .where((q) => q("code").equals(code))
        .where((q) => q("used_at").isNull())
        .update({ used_at: new Date().toISOString() })
        .returning(
          "code",
          "client_id",
          "user_id",
          "redirect_uri",
          "code_challenge",
          "scope",
          "expires_at",
          "nonce",
          "auth_time",
        ),
    )) as Array<
      Pick<AuthCodeRow, "code" | "client_id" | "user_id" | "redirect_uri" | "code_challenge" | "scope" | "expires_at"> & {
        readonly nonce: string | null;
        readonly auth_time: number | null;
      }
    >;

    const claimedCode = claimed[0];
    if (!claimedCode) return oauthError(c, 400, "invalid_grant", "Code not found or already used");
    if (new Date(claimedCode.expires_at).getTime() < Date.now()) {
      return oauthError(c, 400, "invalid_grant", "Code expired");
    }
    if (claimedCode.client_id !== clientId) {
      return oauthError(c, 400, "invalid_grant", "Code was issued for a different client");
    }
    if (claimedCode.redirect_uri !== redirectUri) {
      return oauthError(c, 400, "invalid_grant", "redirect_uri does not match the one used at /oauth/authorize");
    }
    if (!verifyPkceS256(codeVerifier, claimedCode.code_challenge)) {
      return oauthError(c, 400, "invalid_grant", "PKCE verifier did not match the challenge");
    }

    const user = await cfg.loadUser(cfg.db, claimedCode.user_id);
    if (!user) return oauthError(c, 400, "invalid_grant", "User no longer exists");

    const tokens = await issueTokens(cfg.db, tables, cfg, user, clientId, claimedCode.scope, {
      request: c.request,
      nonce: claimedCode.nonce ?? undefined,
      authTime: claimedCode.auth_time ?? undefined,
    });
    logAudit(cfg, {
      userId: user.id,
      event: "oauth.token_issued",
      metadata: { client_id: clientId, grant: "authorization_code", scope: claimedCode.scope },
      ip: requestCtx.ip ?? null,
      userAgent: requestCtx.userAgent ?? null,
    });
    return json(c, 200, tokens);
  };

  const handleRefreshToken = async (c: Conn, body: Record<string, string | undefined>) => {
    const requestCtx = ctx(c.request);
    const clientId = body.client_id;
    const refreshToken = body.refresh_token;
    const requestedScope = body.scope;
    const clientSecret = body.client_secret;

    if (!clientId || !refreshToken) {
      return oauthError(c, 400, "invalid_request", "client_id and refresh_token are required");
    }
    const client = await findClient(cfg.db, tables.clients, clientId);
    if (!client || client.revoked_at) return oauthError(c, 400, "invalid_client", "Unknown or revoked client");
    if (!verifyClientCredentials(client, clientSecret)) {
      return oauthError(c, 401, "invalid_client", "Bad client credentials");
    }

    const tokenHash = sha256(refreshToken);
    const row = (await cfg.db.one(
      from(tables.refreshTokens).where((q) => q("token_hash").equals(tokenHash)),
    )) as RefreshTokenRow | null;

    if (!row) return oauthError(c, 400, "invalid_grant", "Unknown refresh token");
    if (row.client_id !== clientId) {
      return oauthError(c, 400, "invalid_grant", "Token was issued for a different client");
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return oauthError(c, 400, "invalid_grant", "Refresh token expired");
    }
    if (row.revoked_at) {
      // Revoked-but-presented is a strong signal of leakage — burn the entire
      // chain that descended from this token's parent.
      const now = new Date().toISOString();
      await cfg.db.execute(
        from(tables.refreshTokens)
          .where((q) => q("user_id").equals(row.user_id))
          .where((q) => q("client_id").equals(row.client_id))
          .where((q) => q("revoked_at").isNull())
          .update({ revoked_at: now }),
      );
      logAudit(cfg, {
        userId: row.user_id,
        event: "oauth.refresh_reuse_detected",
        metadata: { client_id: row.client_id },
        ip: requestCtx.ip ?? null,
        userAgent: requestCtx.userAgent ?? null,
      });
      return oauthError(c, 400, "invalid_grant", "Refresh token has been revoked");
    }

    // Rotate: revoke this refresh, mint a new pair.
    await cfg.db.execute(
      from(tables.refreshTokens)
        .where((q) => q("token_hash").equals(tokenHash))
        .update({ revoked_at: new Date().toISOString() }),
    );

    // Scope down-narrowing only — never widen.
    let scope = row.scope;
    if (requestedScope) {
      const requested = parseScope(requestedScope);
      const original = parseScope(row.scope);
      const downscoped = requested.filter((s) => original.includes(s));
      if (downscoped.length === 0) {
        return oauthError(c, 400, "invalid_scope", "Requested scope must be a subset of the original grant");
      }
      scope = formatScope(downscoped);
    }

    const user = await cfg.loadUser(cfg.db, row.user_id);
    if (!user) return oauthError(c, 400, "invalid_grant", "User no longer exists");

    const tokens = await issueTokens(cfg.db, tables, cfg, user, clientId, scope, { request: c.request }, tokenHash);
    logAudit(cfg, {
      userId: user.id,
      event: "oauth.token_refreshed",
      metadata: { client_id: clientId, scope },
      ip: requestCtx.ip ?? null,
      userAgent: requestCtx.userAgent ?? null,
    });
    return json(c, 200, tokens);
  };

  const handleDeviceCode = async (c: Conn, body: Record<string, string | undefined>) => {
    const requestCtx = ctx(c.request);
    const clientId = body.client_id;
    const deviceCode = body.device_code;
    const clientSecret = body.client_secret;

    if (!clientId || !deviceCode) {
      return oauthError(c, 400, "invalid_request", "client_id and device_code are required");
    }
    const client = await findClient(cfg.db, tables.clients, clientId);
    if (!client || client.revoked_at) return oauthError(c, 400, "invalid_client", "Unknown or revoked client");
    if (!verifyClientCredentials(client, clientSecret)) {
      return oauthError(c, 401, "invalid_client", "Bad client credentials");
    }

    const row = (await cfg.db.one(
      from(tables.deviceCodes).where((q) => q("device_code").equals(deviceCode)),
    )) as DeviceCodeRow | null;

    if (!row) return oauthError(c, 400, "invalid_grant", "Unknown device_code");
    if (row.client_id !== clientId) {
      return oauthError(c, 400, "invalid_grant", "Code was issued for a different client");
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return oauthError(c, 400, "expired_token", "Device code expired");
    }

    // Per RFC 8628: enforce slow_down if the client polls faster than the
    // advertised interval.
    const now = Date.now();
    const last = row.last_polled_at ? new Date(row.last_polled_at).getTime() : 0;
    if (last && now - last < (DEVICE_POLL_INTERVAL_SECONDS - 1) * 1000) {
      await cfg.db.execute(
        from(tables.deviceCodes)
          .where((q) => q("device_code").equals(deviceCode))
          .update({ last_polled_at: new Date().toISOString() }),
      );
      return oauthError(c, 400, "slow_down", "Polling too fast — wait at least the advertised interval");
    }
    await cfg.db.execute(
      from(tables.deviceCodes)
        .where((q) => q("device_code").equals(deviceCode))
        .update({ last_polled_at: new Date().toISOString() }),
    );

    if (row.denied_at) return oauthError(c, 400, "access_denied", "User denied the authorization request");
    if (!row.approved_at || row.user_id === null) {
      return oauthError(c, 400, "authorization_pending", "Waiting for user approval");
    }

    // Approved — burn the code (single use) and issue tokens.
    await cfg.db.execute(
      from(tables.deviceCodes)
        .where((q) => q("device_code").equals(deviceCode))
        .del(),
    );

    const user = await cfg.loadUser(cfg.db, row.user_id);
    if (!user) return oauthError(c, 400, "invalid_grant", "User no longer exists");

    const tokens = await issueTokens(cfg.db, tables, cfg, user, clientId, row.scope, { request: c.request });
    logAudit(cfg, {
      userId: user.id,
      event: "oauth.token_issued",
      metadata: { client_id: clientId, grant: "device_code", scope: row.scope },
      ip: requestCtx.ip ?? null,
      userAgent: requestCtx.userAgent ?? null,
    });
    return json(c, 200, tokens);
  };

  const handle = async (c: Conn) => {
    const body = (c.body ?? {}) as Record<string, string | undefined>;
    const grantType = body.grant_type;

    if (grantType === "authorization_code") return handleAuthorizationCode(c, body);
    if (grantType === "refresh_token") return handleRefreshToken(c, body);
    if (grantType === DEVICE_CODE_GRANT) return handleDeviceCode(c, body);

    return oauthError(c, 400, "unsupported_grant_type", `Unknown grant_type: ${grantType ?? "(missing)"}`);
  };

  return [post(`${basePath}/token`, parseBody(handle))];
};

// Re-export so package consumers can avoid the deep path.
export type { ClientRow };
