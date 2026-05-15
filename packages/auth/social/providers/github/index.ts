import { buildQuery, getJson, postForm, toTokenSet } from "../../http/index.ts";
import type { SocialProfile, SocialProvider, TokenSet } from "../index.ts";

export type GithubConfig = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly allowSignup?: boolean;
};

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
const EMAILS_URL = "https://api.github.com/user/emails";
const DEFAULT_SCOPES = ["read:user", "user:email"] as const;

type GithubUser = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type GithubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
};

export const github = (cfg: GithubConfig): SocialProvider<GithubConfig> => ({
  name: "github",
  config: cfg,
  defaultScopes: DEFAULT_SCOPES,
  authorizeUrl: (params) => {
    const scopes = (params.scopes ?? DEFAULT_SCOPES).join(" ");
    const query = buildQuery({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      scope: scopes,
      state: params.state,
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256",
      allow_signup: cfg.allowSignup === false ? "false" : undefined,
      ...params.extraParams,
    });
    return `${AUTHORIZE_URL}?${query}`;
  },
  exchange: async (params) => {
    const raw = await postForm(TOKEN_URL, {
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: cfg.redirectUri,
    });
    return toTokenSet(raw);
  },
  profile: async (tokens: TokenSet) => {
    const headers = {
      authorization: `Bearer ${tokens.accessToken}`,
      "user-agent": "atlas-auth",
      accept: "application/vnd.github+json",
    };
    const user = await getJson<GithubUser>(USER_URL, headers);
    let email = user.email;
    let verified = email !== null;
    if (!email) {
      try {
        const emails = await getJson<GithubEmail[]>(EMAILS_URL, headers);
        const primary = emails.find((e) => e.primary) ?? emails[0];
        if (primary) {
          email = primary.email;
          verified = primary.verified;
        }
      } catch {
        // user denied user:email scope — leave email null
      }
    }
    const profile: SocialProfile = {
      provider: "github",
      id: String(user.id),
      email,
      emailVerified: verified,
      name: user.name,
      picture: user.avatar_url,
      username: user.login,
      raw: user as unknown as Record<string, unknown>,
    };
    return profile;
  },
});
