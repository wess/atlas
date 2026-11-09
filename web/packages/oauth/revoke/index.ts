import { from } from "../../db/query.ts";
import type { Conn, Route } from "../../server/index.ts";
import { json, parseForm, parseJson, pipeline, post } from "../../server/index.ts";
import { findClient, verifyClientCredentials } from "../clients";
import { sha256 } from "../helpers";
import { type OAuthConfig, type RefreshTokenRow, resolveTables } from "../types.ts";

const invalidClient = (c: Conn) =>
  json(c, 401, { error: "invalid_client", error_description: "Client authentication failed" });

/**
 * RFC 7009 token revocation. Per spec the endpoint silently succeeds even if
 * the token doesn't exist, to avoid leaking validity info. Only refresh tokens
 * are revoked here — access tokens are short-lived JWTs that expire on their
 * own.
 *
 * A token issued to a confidential client can only be revoked by that client
 * authenticating with `client_id` + `client_secret`. A public client's token
 * can be revoked by whoever holds it (there is no secret to check), and a
 * `client_id` that is sent must own the token.
 */
export const oauthRevokeRoutes = (cfg: OAuthConfig, basePath = "/oauth"): readonly Route[] => {
  const tables = resolveTables(cfg);
  const parseBody = pipeline(parseJson, parseForm);

  const handle = async (c: Conn) => {
    const body = (c.body ?? {}) as Record<string, string | undefined>;
    const tokenStr = body.token;
    if (!tokenStr) return json(c, 400, { error: "invalid_request", error_description: "token is required" });

    const clientId = body.client_id;
    if (clientId) {
      const client = await findClient(cfg.db, tables.clients, clientId);
      if (!client || client.revoked_at || !verifyClientCredentials(client, body.client_secret)) return invalidClient(c);
    }

    if (tokenStr.startsWith("oat_")) {
      const tokenHash = sha256(tokenStr);
      const row = (await cfg.db.one(
        from(tables.refreshTokens)
          .where((q) => q("token_hash").equals(tokenHash))
          .select("client_id"),
      )) as Pick<RefreshTokenRow, "client_id"> | null;
      if (row) {
        if (clientId && row.client_id !== clientId) {
          return json(c, 400, { error: "invalid_request", error_description: "Token was issued to another client" });
        }
        if (!clientId) {
          const owner = await findClient(cfg.db, tables.clients, row.client_id);
          if (owner?.client_secret_hash) return invalidClient(c);
        }
        await cfg.db.execute(
          from(tables.refreshTokens)
            .where((q) => q("token_hash").equals(tokenHash))
            .where((q) => q("revoked_at").isNull())
            .update({ revoked_at: new Date().toISOString() }),
        );
      }
    }
    return json(c, 200, {});
  };

  return [post(`${basePath}/revoke`, parseBody(handle))];
};
