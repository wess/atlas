import { buildQuery, decodeIdTokenPayload, postForm, toTokenSet } from "../../http/index.ts";
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
      ...params.extraParams,
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
    const claims = tokens.idToken ? decodeIdTokenPayload(tokens.idToken) : {};
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
