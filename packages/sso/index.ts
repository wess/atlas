// @atlas/sso — drop-in OIDC relying-party. Any Atlas app gains "Sign in with
// $IdP" by calling mountSso(...) and providing two callbacks: onAuthenticated
// (claims → local user row) and issueSession (set whatever session the host
// app uses). The package handles discovery, PKCE, state, code exchange,
// id_token verification, and back-channel logout.

import { token as jwt } from "@atlas/auth";
import type { Connection } from "@atlas/db";
import type { Route } from "@atlas/server";
import { get, halt, json, parseForm, parseJson, pipeline, post, redirect } from "@atlas/server";
import { clearDiscoveryCache, discover } from "./discovery.ts";
import { newPkcePair, randomNonce, randomState } from "./pkce.ts";
import { consumeState, writeState } from "./state.ts";
import type { IdTokenClaims, SsoConfig } from "./types.ts";

export type { IdTokenClaims, SsoConfig, AuthenticatedUser, SessionIssuer, DiscoveryDoc } from "./types.ts";
export { sweepExpiredSsoState } from "./state.ts";
export { clearDiscoveryCache };
export { ensureSsoStateTable } from "./migrate.ts";

const issuerOf = (req: Request): string => {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
};

const defaultRedirectUri = (req: Request, basePath: string): string =>
  `${issuerOf(req)}${basePath}/callback`;

const ensureOpenIdScope = (scopes: readonly string[]): readonly string[] =>
  scopes.includes("openid") ? scopes : ["openid", ...scopes];

type DiscoveryEntry = Awaited<ReturnType<typeof discover>>;

/**
 * Mount the SSO relying-party routes. Returns the routes; the caller spreads
 * them into their `router(...)`. The package does no IO until a request
 * actually hits a route.
 */
export const mountSso = (cfg: SsoConfig): readonly Route[] => {
  const basePath = cfg.basePath ?? "/auth/sso";
  const stateTable = cfg.stateTable ?? "sso_state";
  const defaultPath = cfg.defaultPostLoginPath ?? "/";
  const scopes = ensureOpenIdScope(cfg.scopes ?? ["openid", "email", "profile"]);
  const parseBody = pipeline(parseJson, parseForm);

  return [
    /**
     * Kick the redirect dance. Generates state + PKCE + nonce, persists them,
     * 302s to the IdP's authorize endpoint. Honors an optional `return_to`
     * query parameter for deep-linking back into the app post-login.
     */
    get(`${basePath}/login`, async (c) => {
      const url = new URL(c.request.url);
      const returnTo = url.searchParams.get("return_to") || defaultPath;

      let disc: DiscoveryEntry;
      try {
        disc = await discover(cfg.issuerUrl);
      } catch (err) {
        return halt(c, 502, {
          error: "sso_discovery_failed",
          error_description: err instanceof Error ? err.message : String(err),
        });
      }

      const state = randomState();
      const nonce = randomNonce();
      const pkce = newPkcePair();

      await writeState(cfg.db, stateTable, {
        state,
        verifier: pkce.verifier,
        nonce,
        returnTo,
      });

      const authUrl = new URL(disc.doc.authorization_endpoint);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", cfg.clientId);
      authUrl.searchParams.set("redirect_uri", cfg.redirectUri ?? defaultRedirectUri(c.request, basePath));
      authUrl.searchParams.set("scope", scopes.join(" "));
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("nonce", nonce);
      authUrl.searchParams.set("code_challenge", pkce.challenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      return redirect(c, authUrl.toString(), 302);
    }),

    /**
     * IdP redirected the user back. Validate state, exchange code, verify
     * id_token, call onAuthenticated, issue local session, redirect home.
     */
    get(`${basePath}/callback`, async (c) => {
      const url = new URL(c.request.url);
      const code = url.searchParams.get("code");
      const stateParam = url.searchParams.get("state");
      const errParam = url.searchParams.get("error");
      if (errParam) {
        return halt(c, 400, {
          error: errParam,
          error_description: url.searchParams.get("error_description") ?? "IdP refused the authorization request",
        });
      }
      if (!code || !stateParam) {
        return halt(c, 400, { error: "invalid_request", error_description: "Missing code or state" });
      }
      const stateRow = await consumeState(cfg.db, stateTable, stateParam);
      if (!stateRow) {
        return halt(c, 400, { error: "invalid_state", error_description: "Unknown or expired state" });
      }

      let disc: DiscoveryEntry;
      try {
        disc = await discover(cfg.issuerUrl);
      } catch (err) {
        return halt(c, 502, {
          error: "sso_discovery_failed",
          error_description: err instanceof Error ? err.message : String(err),
        });
      }

      const redirectUri = cfg.redirectUri ?? defaultRedirectUri(c.request, basePath);
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code_verifier: stateRow.verifier,
      });

      const tokRes = await fetch(disc.doc.token_endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body,
      });
      const tokText = await tokRes.text();
      if (!tokRes.ok) {
        return halt(c, 502, {
          error: "token_exchange_failed",
          error_description: `IdP returned HTTP ${tokRes.status}: ${tokText.slice(0, 200)}`,
        });
      }
      const tokens = JSON.parse(tokText) as { id_token?: string; access_token?: string };
      if (!tokens.id_token) {
        return halt(c, 502, { error: "missing_id_token", error_description: "IdP token response had no id_token" });
      }

      let claims: IdTokenClaims;
      try {
        const payload = await jwt.verifyRs256(tokens.id_token, { keys: disc.jwks.keys as any });
        claims = payload as IdTokenClaims;
      } catch (err) {
        // First failure might mean the IdP rotated keys. Refresh and retry once.
        clearDiscoveryCache(cfg.issuerUrl);
        try {
          const fresh = await discover(cfg.issuerUrl);
          const payload = await jwt.verifyRs256(tokens.id_token, { keys: fresh.jwks.keys as any });
          claims = payload as IdTokenClaims;
        } catch (err2) {
          return halt(c, 502, {
            error: "id_token_invalid",
            error_description: err2 instanceof Error ? err2.message : String(err2),
          });
        }
      }

      // Validate nonce + aud + iss bindings.
      if (claims.nonce !== stateRow.nonce) {
        return halt(c, 400, { error: "nonce_mismatch", error_description: "id_token nonce does not match" });
      }
      const audOk = Array.isArray(claims.aud) ? claims.aud.includes(cfg.clientId) : claims.aud === cfg.clientId;
      if (!audOk) {
        return halt(c, 400, { error: "aud_mismatch", error_description: "id_token aud does not match client_id" });
      }
      if (claims.iss !== cfg.issuerUrl && claims.iss.replace(/\/+$/, "") !== cfg.issuerUrl.replace(/\/+$/, "")) {
        return halt(c, 400, { error: "iss_mismatch", error_description: "id_token iss does not match issuer" });
      }

      let user: Awaited<ReturnType<typeof cfg.onAuthenticated>>;
      try {
        user = await cfg.onAuthenticated(cfg.db, claims);
      } catch (err) {
        return halt(c, 500, {
          error: "provisioning_failed",
          error_description: err instanceof Error ? err.message : String(err),
        });
      }

      // Hand off to host-issued session. The session helper is responsible
      // for setting cookies / writing rows / etc. and returning the
      // already-redirected Conn.
      const withSession = await cfg.issueSession(c, user, claims);
      // If the session helper didn't redirect, do it ourselves.
      if (!withSession.halted) {
        return redirect(withSession, stateRow.return_to || defaultPath, 302);
      }
      return withSession;
    }),

    /**
     * Back-channel logout receiver. IdP POSTs `logout_token=<jwt>`. Verify,
     * look up local user by sub, invalidate sessions. Per spec §2.6 the
     * response must be `application/json` with no caching headers.
     */
    post(
      `${basePath}/backchannel-logout`,
      parseBody(async (c) => {
        const body = (c.body ?? {}) as Record<string, string | undefined>;
        const tokenStr = body.logout_token;
        if (!tokenStr) {
          return halt(c, 400, { error: "invalid_request", error_description: "logout_token required" });
        }

        let disc: DiscoveryEntry;
        try {
          disc = await discover(cfg.issuerUrl);
        } catch (err) {
          return halt(c, 502, {
            error: "sso_discovery_failed",
            error_description: err instanceof Error ? err.message : String(err),
          });
        }

        let payload: jwt.TokenPayload;
        try {
          payload = await jwt.verifyRs256(tokenStr, { keys: disc.jwks.keys as any });
        } catch (err) {
          return halt(c, 400, {
            error: "invalid_token",
            error_description: err instanceof Error ? err.message : String(err),
          });
        }
        const events = payload.events as Record<string, unknown> | undefined;
        if (!events || !events["http://schemas.openid.net/event/backchannel-logout"]) {
          return halt(c, 400, {
            error: "invalid_token",
            error_description: "logout_token missing back-channel-logout event",
          });
        }
        // Per spec: logout_token MUST NOT contain a `nonce`.
        if (payload.nonce !== undefined) {
          return halt(c, 400, { error: "invalid_token", error_description: "logout_token must not carry nonce" });
        }
        const sub = typeof payload.sub === "string" ? payload.sub : null;
        if (!sub) {
          return halt(c, 400, { error: "invalid_token", error_description: "logout_token missing sub" });
        }

        let localUserId: number | string | null = null;
        if (cfg.findLocalUserBySub) {
          localUserId = await cfg.findLocalUserBySub(cfg.db, sub);
        }
        if (cfg.invalidateSessions) {
          await Promise.resolve(cfg.invalidateSessions(cfg.db, { sub, localUserId }));
        }

        const out = json(c, 200, { ok: true });
        out.respHeaders.set("cache-control", "no-store");
        return out;
      }),
    ),
  ];
};
