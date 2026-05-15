import { buildQuery, getJson, postForm, toTokenSet } from "../../http/index.ts";
import type { SocialProfile, SocialProvider, TokenSet } from "../index.ts";

export type TwitterConfig = {
  readonly clientId: string;
  /**
   * Optional. Required only for confidential clients (server-side apps with a
   * client secret configured in the Twitter dev portal). Public PKCE-only
   * clients should leave this undefined.
   */
  readonly clientSecret?: string;
  readonly redirectUri: string;
  /** Profile fields requested from /2/users/me. Default sensible set. */
  readonly userFields?: readonly string[];
};

const AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const ME_URL = "https://api.twitter.com/2/users/me";
const DEFAULT_SCOPES = ["users.read", "tweet.read", "offline.access"] as const;
const DEFAULT_USER_FIELDS = ["id", "name", "username", "profile_image_url"] as const;

type TwitterUserResponse = {
  data?: {
    id: string;
    name?: string;
    username?: string;
    profile_image_url?: string;
  };
};

export const twitter = (cfg: TwitterConfig): SocialProvider<TwitterConfig> => ({
  name: "twitter",
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
      ...params.extraParams,
    });
    return `${AUTHORIZE_URL}?${query}`;
  },
  exchange: async (params) => {
    const headers: Record<string, string> = {};
    if (cfg.clientSecret) {
      const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
      headers.authorization = `Basic ${basic}`;
    }
    const raw = await postForm(
      TOKEN_URL,
      {
        grant_type: "authorization_code",
        client_id: cfg.clientId,
        code: params.code,
        code_verifier: params.codeVerifier,
        redirect_uri: cfg.redirectUri,
      },
      headers,
    );
    return toTokenSet(raw);
  },
  profile: async (tokens: TokenSet) => {
    const fields = (cfg.userFields ?? DEFAULT_USER_FIELDS).join(",");
    const url = `${ME_URL}?user.fields=${encodeURIComponent(fields)}`;
    const json = await getJson<TwitterUserResponse>(url, { authorization: `Bearer ${tokens.accessToken}` });
    const user = json.data;
    if (!user) {
      throw new Error("Twitter /users/me returned no 'data' payload.");
    }
    const profile: SocialProfile = {
      provider: "twitter",
      id: user.id,
      email: null,
      emailVerified: false,
      name: user.name ?? null,
      picture: user.profile_image_url ?? null,
      username: user.username ?? null,
      raw: json as unknown as Record<string, unknown>,
    };
    return profile;
  },
});
