import { buildQuery, getJson, postForm, toTokenSet } from "../../http/index.ts";
import type { SocialProfile, SocialProvider, TokenSet } from "../index.ts";

export type FacebookConfig = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  /** Graph API version. Default: `v19.0`. */
  readonly apiVersion?: string;
  /** Profile fields requested from /me. Default: `id,name,email,picture`. */
  readonly profileFields?: readonly string[];
};

const DEFAULT_SCOPES = ["email", "public_profile"] as const;
const DEFAULT_VERSION = "v19.0";
const DEFAULT_FIELDS = ["id", "name", "email", "picture"] as const;

type FacebookUser = {
  id: string;
  name?: string;
  email?: string;
  picture?: { data?: { url?: string } };
};

export const facebook = (cfg: FacebookConfig): SocialProvider<FacebookConfig> => {
  const version = cfg.apiVersion ?? DEFAULT_VERSION;
  const authorize = `https://www.facebook.com/${version}/dialog/oauth`;
  const token = `https://graph.facebook.com/${version}/oauth/access_token`;
  const me = `https://graph.facebook.com/${version}/me`;
  const fields = (cfg.profileFields ?? DEFAULT_FIELDS).join(",");

  return {
    name: "facebook",
    config: cfg,
    defaultScopes: DEFAULT_SCOPES,
    authorizeUrl: (params) => {
      const scopes = (params.scopes ?? DEFAULT_SCOPES).join(",");
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
      return `${authorize}?${query}`;
    },
    exchange: async (params) => {
      const raw = await postForm(token, {
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
      const url = `${me}?fields=${encodeURIComponent(fields)}`;
      const user = await getJson<FacebookUser>(url, { authorization: `Bearer ${tokens.accessToken}` });
      const profile: SocialProfile = {
        provider: "facebook",
        id: user.id,
        email: user.email ?? null,
        emailVerified: Boolean(user.email),
        name: user.name ?? null,
        picture: user.picture?.data?.url ?? null,
        raw: user as unknown as Record<string, unknown>,
      };
      return profile;
    },
  };
};
