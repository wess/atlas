import { from } from "../../db/index.ts";
import type { Conn, Route } from "../../server/index.ts";
import { json, parseForm, parseJson, pipeline, post } from "../../server/index.ts";
import { sha256 } from "../helpers";
import { type OAuthConfig, resolveTables } from "../types.ts";

/**
 * RFC 7009 token revocation. Per spec the endpoint silently succeeds even if
 * the token doesn't exist, to avoid leaking validity info. Only refresh tokens
 * are revoked here — access tokens are short-lived JWTs that expire on their
 * own.
 */
export const oauthRevokeRoutes = (cfg: OAuthConfig, basePath = "/oauth"): readonly Route[] => {
  const tables = resolveTables(cfg);
  const parseBody = pipeline(parseJson, parseForm);

  const handle = async (c: Conn) => {
    const body = (c.body ?? {}) as Record<string, string | undefined>;
    const tokenStr = body.token;
    if (!tokenStr) return json(c, 400, { error: "invalid_request", error_description: "token is required" });

    if (tokenStr.startsWith("oat_")) {
      const tokenHash = sha256(tokenStr);
      await cfg.db.execute(
        from(tables.refreshTokens)
          .where((q) => q("token_hash").equals(tokenHash))
          .update({ revoked_at: new Date().toISOString() }),
      );
    }
    return json(c, 200, {});
  };

  return [post(`${basePath}/revoke`, parseBody(handle))];
};
