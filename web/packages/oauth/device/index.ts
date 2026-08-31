import { from } from "../../db/index.ts";
import type { Conn, Route } from "../../server/index.ts";
import { get, json, parseForm, parseJson, pipeline, post } from "../../server/index.ts";
import { findClient } from "../clients";
import {
  DEVICE_CODE_TTL_SECONDS,
  DEVICE_POLL_INTERVAL_SECONDS,
  formatScope,
  includesScopes,
  newUserCode,
  normalizeUserCode,
  parseScope,
  randomId,
} from "../helpers";
import {
  authIdOf,
  type ClientRow,
  ctxOf,
  type DeviceCodeRow,
  logAudit,
  type OAuthConfig,
  resolveTables,
} from "../types.ts";

const defaultVerificationUri = (req: Request): string => {
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}/pair`;
};

/**
 * RFC 8628 device-authorization flow.
 *
 *   POST /oauth/device/authorize  → desktop client kicks off the flow
 *   GET  /oauth/device/info       → SPA fetches consent metadata
 *   POST /oauth/device/approve    → SPA records user approval
 *   POST /oauth/device/deny       → SPA records user denial
 */
export const oauthDeviceRoutes = (cfg: OAuthConfig, basePath = "/oauth"): readonly Route[] => {
  const tables = resolveTables(cfg);
  const authId = authIdOf(cfg);
  const ctx = ctxOf(cfg);
  const verificationUri = cfg.buildVerificationUri ?? defaultVerificationUri;
  const parseBody = pipeline(parseJson, parseForm);
  const guard = pipeline(cfg.requireUser);
  const authed = pipeline(cfg.requireUser, parseJson);

  const startFlow = async (c: Conn) => {
    const body = (c.body ?? {}) as { client_id?: string; scope?: string };
    const clientId = body.client_id;
    if (!clientId) {
      return json(c, 400, { error: "invalid_request", error_description: "client_id is required" });
    }
    const client = (await findClient(cfg.db, tables.clients, clientId)) as ClientRow | null;
    if (!client || client.revoked_at) {
      return json(c, 400, { error: "invalid_client", error_description: "Unknown or revoked client" });
    }
    const allowed = JSON.parse(client.allowed_scopes) as string[];
    const requested = parseScope(body.scope);
    const scopes = requested.length === 0 ? allowed : [...requested];
    if (!includesScopes(allowed, scopes)) {
      return json(c, 400, {
        error: "invalid_scope",
        error_description: `Requested scopes must be a subset of: ${allowed.join(" ")}`,
      });
    }

    const deviceCode = randomId(32);
    const userCode = newUserCode();
    const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_SECONDS * 1000);

    await cfg.db.execute(
      from(tables.deviceCodes).insert({
        device_code: deviceCode,
        user_code: userCode,
        client_id: clientId,
        scope: formatScope(scopes),
        expires_at: expiresAt.toISOString(),
      }),
    );

    const verifyUri = verificationUri(c.request);
    return json(c, 200, {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verifyUri,
      verification_uri_complete: `${verifyUri}?code=${encodeURIComponent(userCode)}`,
      expires_in: DEVICE_CODE_TTL_SECONDS,
      interval: DEVICE_POLL_INTERVAL_SECONDS,
    });
  };

  const showInfo = async (c: Conn) => {
    const url = new URL(c.request.url);
    const userCode = normalizeUserCode(url.searchParams.get("user_code") ?? "");
    if (userCode.length === 0) {
      return json(c, 400, { error: "invalid_request", error_description: "user_code is required" });
    }
    const row = (await cfg.db.one(
      from(tables.deviceCodes).where((q) => q("user_code").equals(userCode)),
    )) as DeviceCodeRow | null;
    if (!row) {
      return json(c, 404, {
        error: "not_found",
        error_description: "No matching code — check the characters and try again.",
      });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json(c, 410, {
        error: "expired_token",
        error_description: "This code has expired — go back to your app and start over.",
      });
    }
    if (row.approved_at || row.denied_at) {
      return json(c, 409, {
        error: "already_decided",
        error_description: "This code has already been used.",
      });
    }
    const client = (await findClient(cfg.db, tables.clients, row.client_id)) as ClientRow | null;
    if (!client || client.revoked_at) {
      return json(c, 400, { error: "invalid_client", error_description: "Client no longer exists." });
    }
    return json(c, 200, {
      client: {
        client_id: client.client_id,
        name: client.name,
        description: client.description,
        icon_url: client.icon_url,
        is_official: client.is_official,
      },
      scopes: parseScope(row.scope),
      user_code: row.user_code,
    });
  };

  const approve = async (c: Conn) => {
    const body = c.body as { user_code?: string };
    const userCode = normalizeUserCode(body.user_code ?? "");
    if (!userCode) return json(c, 400, { error: "invalid_request", error_description: "user_code is required" });
    const userId = authId(c);
    const requestCtx = ctx(c.request);

    const claimed = (await cfg.db.execute(
      from(tables.deviceCodes)
        .where((q) => q("user_code").equals(userCode))
        .where((q) => q("approved_at").isNull())
        .where((q) => q("denied_at").isNull())
        .update({ approved_at: new Date().toISOString(), user_id: userId })
        .returning("device_code", "client_id", "expires_at"),
    )) as Array<{ device_code: string; client_id: string; expires_at: string }>;

    const row = claimed[0];
    if (!row) {
      return json(c, 404, {
        error: "not_found",
        error_description: "No active code — it may have expired or already been used.",
      });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await cfg.db.execute(
        from(tables.deviceCodes)
          .where((q) => q("device_code").equals(row.device_code))
          .update({ approved_at: null }),
      );
      return json(c, 410, {
        error: "expired_token",
        error_description: "This code expired before you could approve it.",
      });
    }

    logAudit(cfg, {
      userId,
      event: "oauth.device_approved",
      metadata: { client_id: row.client_id },
      ip: requestCtx.ip ?? null,
      userAgent: requestCtx.userAgent ?? null,
    });
    return json(c, 200, { ok: true });
  };

  const deny = async (c: Conn) => {
    const body = c.body as { user_code?: string };
    const userCode = normalizeUserCode(body.user_code ?? "");
    if (!userCode) return json(c, 400, { error: "invalid_request", error_description: "user_code is required" });
    const userId = authId(c);
    const requestCtx = ctx(c.request);

    const claimed = (await cfg.db.execute(
      from(tables.deviceCodes)
        .where((q) => q("user_code").equals(userCode))
        .where((q) => q("approved_at").isNull())
        .where((q) => q("denied_at").isNull())
        .update({ denied_at: new Date().toISOString(), user_id: userId })
        .returning("device_code", "client_id"),
    )) as Array<{ device_code: string; client_id: string }>;

    const row = claimed[0];
    if (!row) return json(c, 404, { error: "not_found" });

    logAudit(cfg, {
      userId,
      event: "oauth.device_denied",
      metadata: { client_id: row.client_id },
      ip: requestCtx.ip ?? null,
      userAgent: requestCtx.userAgent ?? null,
    });
    return json(c, 200, { ok: true });
  };

  return [
    post(`${basePath}/device/authorize`, parseBody(startFlow)),
    get(`${basePath}/device/info`, guard(showInfo)),
    post(`${basePath}/device/approve`, authed(approve)),
    post(`${basePath}/device/deny`, authed(deny)),
  ];
};
