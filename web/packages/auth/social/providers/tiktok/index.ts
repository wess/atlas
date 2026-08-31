import { buildQuery, getJson, postForm, toTokenSet } from "../../http/index.ts";
import type { SocialProfile, SocialProvider, TokenSet } from "../index.ts";

export type TiktokConfig = {
  /** TikTok calls this `client_key` in their dashboard, not `client_id`. */
  readonly clientKey: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  /**
   * Profile fields to request from `/v2/user/info/`. Default covers the basic
   * identity fields available under `user.info.basic`. Add more (e.g.
   * `username`, `bio_description`, `profile_deep_link`) if your app is approved
   * for the corresponding scopes.
   */
  readonly userFields?: readonly string[];
};

const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const DEFAULT_SCOPES = ["user.info.basic"] as const;
const DEFAULT_USER_FIELDS = ["open_id", "union_id", "avatar_url", "display_name"] as const;

type TiktokUserResponse = {
  data?: {
    user?: {
      open_id?: string;
      union_id?: string;
      avatar_url?: string;
      avatar_url_100?: string;
      display_name?: string;
      username?: string;
    };
  };
  error?: { code?: string; message?: string };
};

export const tiktok = (cfg: TiktokConfig): SocialProvider<TiktokConfig> => ({
  name: "tiktok",
  config: cfg,
  defaultScopes: DEFAULT_SCOPES,
  authorizeUrl: (params) => {
    const scopes = (params.scopes ?? DEFAULT_SCOPES).join(",");
    const query = buildQuery({
      client_key: cfg.clientKey,
      response_type: "code",
      scope: scopes,
      redirect_uri: cfg.redirectUri,
      state: params.state,
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256",
      ...params.extraParams,
    });
    return `${AUTHORIZE_URL}?${query}`;
  },
  exchange: async (params) => {
    const raw = await postForm(TOKEN_URL, {
      client_key: cfg.clientKey,
      client_secret: cfg.clientSecret,
      code: params.code,
      grant_type: "authorization_code",
      redirect_uri: cfg.redirectUri,
      code_verifier: params.codeVerifier,
    });
    return toTokenSet(raw);
  },
  profile: async (tokens: TokenSet) => {
    const fields = (cfg.userFields ?? DEFAULT_USER_FIELDS).join(",");
    const url = `${USER_INFO_URL}?fields=${encodeURIComponent(fields)}`;
    const json = await getJson<TiktokUserResponse>(url, {
      authorization: `Bearer ${tokens.accessToken}`,
    });
    if (json.error?.code && json.error.code !== "ok") {
      throw new Error(`TikTok /user/info error: ${json.error.code} — ${json.error.message ?? ""}`);
    }
    const user = json.data?.user;
    if (!user?.open_id) {
      throw new Error("TikTok /user/info returned no user.open_id payload.");
    }
    const profile: SocialProfile = {
      provider: "tiktok",
      id: user.open_id,
      email: null,
      emailVerified: false,
      name: user.display_name ?? null,
      picture: user.avatar_url ?? user.avatar_url_100 ?? null,
      username: user.username ?? null,
      raw: json as unknown as Record<string, unknown>,
    };
    return profile;
  },
});
