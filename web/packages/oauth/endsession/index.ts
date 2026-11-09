import * as jwt from "../../auth/token/index.ts";
import { from } from "../../db/query.ts";
import type { Conn, Route } from "../../server/index.ts";
import { get, halt, json, parseForm, pipeline, post, redirect } from "../../server/index.ts";
import { isAllowedRedirect, issuerFor } from "../helpers";
import { signLogoutToken } from "../oidc";
import type { ClientRow, OAuthConfig } from "../types.ts";
import { resolveTables } from "../types.ts";

/**
 * OIDC `/oauth/end_session` — relying parties redirect the user-agent here
 * to terminate the session at the IdP. We validate the `id_token_hint`,
 * fan out signed logout_tokens to every client with a registered
 * `backchannel_logout_uri`, then redirect back to
 * `post_logout_redirect_uri` (when allowed).
 *
 * The actual local-session invalidation happens via `onEndSession` — the
 * IdP host knows where its sessions live and how to revoke them.
 *
 * Logout is a cross-site GET by design, so nothing is ended without a valid
 * `id_token_hint` this server signed (issuer must match, and its audience must
 * include `client_id` when one is sent). A request without one only
 * redirects. Also served as POST (form-encoded) per RP-Initiated Logout.
 */
export const oauthEndSessionRoutes = (cfg: OAuthConfig, basePath = "/oauth"): readonly Route[] => {
  if (!cfg.openid) return [];
  const oidc = cfg.openid;
  const tables = resolveTables(cfg);

  const handle = async (c: Conn) => {
    const url = new URL(c.request.url);
    const body = (c.body && typeof c.body === "object" ? c.body : {}) as Record<string, unknown>;
    const param = (name: string): string | null => {
      const value = c.request.method === "POST" ? body[name] : url.searchParams.get(name);
      return typeof value === "string" && value ? value : null;
    };
    const idTokenHint = param("id_token_hint");
    const postLogoutRedirectUri = param("post_logout_redirect_uri");
    const state = param("state");
    const clientIdHint = param("client_id");
    const issuer = issuerFor(cfg, c.request);

    let userId: number | string | null = null;
    if (idTokenHint) {
      try {
        // Verify against own JWKS — we just signed this id_token.
        const jwks = await oidc.jwks();
        const payload = await jwt.verifyRs256(idTokenHint, { keys: jwks.keys });
        const aud = payload.aud;
        const forClient = !clientIdHint || aud === clientIdHint || (Array.isArray(aud) && aud.includes(clientIdHint));
        if (payload.iss === issuer && forClient && payload.sub !== undefined && payload.sub !== null) {
          userId = payload.sub as string;
        }
      } catch {
        // Soft-fail — proceed with logout but skip user-scoped fan-out.
      }
    }

    // Fan out back-channel logout to every client that registered an
    // endpoint. The caller's onEndSession is responsible for actually
    // delivering the POSTs (so HTTP retries / batching are tunable).
    if (userId !== null && oidc.onEndSession) {
      const clients = (await cfg.db.all(
        from(tables.clients)
          .select("client_id", "backchannel_logout_uri")
          .where((q) => q("backchannel_logout_uri").isNotNull())
          .where((q) => q("revoked_at").isNull()),
      )) as Array<Pick<ClientRow, "client_id" | "backchannel_logout_uri">>;

      for (const client of clients) {
        const logoutToken = await signLogoutToken(oidc, {
          issuer,
          audience: client.client_id,
          sub: String(userId),
        });
        await Promise.resolve(
          oidc.onEndSession({
            userId,
            logoutToken,
            issuer,
            clientId: client.client_id,
            backchannelLogoutUri: client.backchannel_logout_uri as string,
          }),
        );
        // Caller delivers the POST per their preferred retry policy.
        // The framework just provides the signed token + per-client iteration.
      }
    }

    if (!postLogoutRedirectUri) return json(c, 200, { ok: true, logged_out: true });

    // Only redirect when the URI is registered to the hint client. Without
    // that bind, /end_session becomes an open redirect.
    if (clientIdHint) {
      const row = (await cfg.db.one(
        from(tables.clients)
          .where((q) => q("client_id").equals(clientIdHint))
          .select("post_logout_redirect_uris"),
      )) as { post_logout_redirect_uris: string | null } | null;
      const allowed = row?.post_logout_redirect_uris ? (JSON.parse(row.post_logout_redirect_uris) as string[]) : [];
      if (!isAllowedRedirect(postLogoutRedirectUri, allowed)) {
        return halt(c, 400, { error: "invalid_request", error_description: "post_logout_redirect_uri not allowed" });
      }
    } else {
      return halt(c, 400, { error: "invalid_request", error_description: "client_id required for redirect" });
    }

    const target = new URL(postLogoutRedirectUri);
    if (state) target.searchParams.set("state", state);
    return redirect(c, target.toString(), 302);
  };

  return [get(`${basePath}/end_session`, handle), post(`${basePath}/end_session`, pipeline(parseForm)(handle))];
};
