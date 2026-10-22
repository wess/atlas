import { buildQuery, postForm, toTokenSet } from "../../http/index.ts";
import { verifyIdToken } from "../../http/oidc.ts";
import type { SocialProfile, SocialProvider, TokenSet } from "../index.ts";

export type MicrosoftConfig = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  /**
   * Tenant. Use `common` for any work + personal account, `consumers` for
   * personal Microsoft accounts only, `organizations` for any work/school
   * account, or a specific tenant ID / domain. Default: `common`.
   */
  readonly tenant?: string;
  readonly prompt?: "login" | "none" | "consent" | "select_account";
};

const DEFAULT_SCOPES = ["openid", "email", "profile", "offline_access"] as const;

const endpoints = (tenant: string) => ({
  authorize: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
  token: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
});

export const microsoft = (cfg: MicrosoftConfig): SocialProvider<MicrosoftConfig> => {
  const tenant = cfg.tenant ?? "common";
  const urls = endpoints(tenant);
  return {
    name: "microsoft",
    config: cfg,
    defaultScopes: DEFAULT_SCOPES,
    authorizeUrl: (params) => {
      const scopes = (params.scopes ?? DEFAULT_SCOPES).join(" ");
      const query = buildQuery({
        ...params.extraParams,
        response_type: "code",
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        response_mode: "query",
        scope: scopes,
        state: params.state,
        code_challenge: params.codeChallenge,
        code_challenge_method: "S256",
        prompt: cfg.prompt,
      });
      return `${urls.authorize}?${query}`;
    },
    exchange: async (params) => {
      const raw = await postForm(urls.token, {
        grant_type: "authorization_code",
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code: params.code,
        code_verifier: params.codeVerifier,
        redirect_uri: cfg.redirectUri,
      });
      return toTokenSet(raw);
    },
    profile: async (tokens: TokenSet) => {
      if (!tokens.idToken) {
        throw new Error("Microsoft token response missing id_token; cannot derive profile.");
      }
      const claims = await verifyIdToken(
        tokens.idToken,
        cfg.clientId,
        "https://login.microsoftonline.com/common/discovery/v2.0/keys",
        (claims) =>
          typeof claims.tid === "string" &&
          /^[a-f0-9-]{36}$/i.test(claims.tid) &&
          claims.iss === `https://login.microsoftonline.com/${claims.tid}/v2.0` &&
          (!/^[a-f0-9-]{36}$/i.test(tenant) || claims.tid.toLowerCase() === tenant.toLowerCase()),
      );
      const sub = (claims.oid as string | undefined) ?? (claims.sub as string | undefined);
      if (!sub) {
        throw new Error("Microsoft id_token missing 'oid' and 'sub' claims; cannot derive user id.");
      }
      const profile: SocialProfile = {
        provider: "microsoft",
        id: sub,
        email:
          (typeof claims.email === "string" ? claims.email : null) ??
          (typeof claims.preferred_username === "string" ? claims.preferred_username : null),
        emailVerified: claims.email_verified === true,
        name: typeof claims.name === "string" ? claims.name : null,
        picture: null,
        username: typeof claims.preferred_username === "string" ? claims.preferred_username : null,
        raw: claims,
      };
      return profile;
    },
  };
};
