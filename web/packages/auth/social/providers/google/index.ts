import { buildQuery, postForm, toTokenSet } from "../../http/index.ts";
import { verifyIdToken } from "../../http/oidc.ts";
import type { SocialProfile, SocialProvider, TokenSet } from "../index.ts";

export type GoogleConfig = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly hostedDomain?: string;
  readonly prompt?: "none" | "consent" | "select_account";
};

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_SCOPES = ["openid", "email", "profile"] as const;

export const google = (cfg: GoogleConfig): SocialProvider<GoogleConfig> => ({
  name: "google",
  config: cfg,
  defaultScopes: DEFAULT_SCOPES,
  authorizeUrl: (params) => {
    const scopes = (params.scopes ?? DEFAULT_SCOPES).join(" ");
    const query = buildQuery({
      ...params.extraParams,
      response_type: "code",
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      scope: scopes,
      state: params.state,
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256",
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: cfg.prompt,
      hd: cfg.hostedDomain,
    });
    return `${AUTHORIZE_URL}?${query}`;
  },
  exchange: async (params) => {
    const raw = await postForm(TOKEN_URL, {
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
    if (!tokens.idToken) throw new Error("Google token response missing id_token");
    const claims = await verifyIdToken(
      tokens.idToken,
      cfg.clientId,
      "https://www.googleapis.com/oauth2/v3/certs",
      (claims) => claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com",
    );
    if (cfg.hostedDomain && claims.hd !== cfg.hostedDomain) throw new Error("Google hosted domain mismatch");
    const sub = claims.sub as string | undefined;
    if (!sub) {
      throw new Error("Google id_token missing 'sub' claim; cannot derive user id.");
    }
    const profile: SocialProfile = {
      provider: "google",
      id: sub,
      email: typeof claims.email === "string" ? claims.email : null,
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === "string" ? claims.name : null,
      picture: typeof claims.picture === "string" ? claims.picture : null,
      raw: claims,
    };
    return profile;
  },
});
