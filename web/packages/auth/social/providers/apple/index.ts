import { buildQuery, decodeIdTokenPayload, postForm, toTokenSet } from "../../http/index.ts";
import type { SocialProfile, SocialProvider, TokenSet } from "../index.ts";

export type AppleConfig = {
  readonly clientId: string;
  readonly teamId: string;
  readonly keyId: string;
  /** PEM-encoded PKCS#8 private key for ES256 (the .p8 you downloaded from Apple). */
  readonly privateKey: string;
  readonly redirectUri: string;
  /**
   * When scopes include `name` or `email`, Apple uses `response_mode=form_post`
   * and POSTs the result to the redirect_uri instead of redirecting. Set this
   * to `query` to opt out (only `openid` works that way). Default: `form_post`.
   */
  readonly responseMode?: "form_post" | "query";
};

const AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
const TOKEN_URL = "https://appleid.apple.com/auth/token";
const AUDIENCE = "https://appleid.apple.com";
const DEFAULT_SCOPES = ["name", "email"] as const;
const CLIENT_SECRET_TTL_SECONDS = 15 * 60;

const b64urlString = (s: string): string => Buffer.from(s, "utf8").toString("base64url");
const b64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");

const importPrivateKey = async (pem: string): Promise<CryptoKey> => {
  const stripped = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const der = Buffer.from(stripped, "base64");
  return crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
};

const mintClientSecret = async (cfg: AppleConfig): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: cfg.keyId, typ: "JWT" };
  const payload = {
    iss: cfg.teamId,
    iat: now,
    exp: now + CLIENT_SECRET_TTL_SECONDS,
    aud: AUDIENCE,
    sub: cfg.clientId,
  };
  const signingInput = `${b64urlString(JSON.stringify(header))}.${b64urlString(JSON.stringify(payload))}`;
  const key = await importPrivateKey(cfg.privateKey);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
};

export const apple = (cfg: AppleConfig): SocialProvider<AppleConfig> => ({
  name: "apple",
  config: cfg,
  defaultScopes: DEFAULT_SCOPES,
  authorizeUrl: (params) => {
    const scopes = (params.scopes ?? DEFAULT_SCOPES).join(" ");
    const query = buildQuery({
      response_type: "code",
      response_mode: cfg.responseMode ?? "form_post",
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
    const clientSecret = await mintClientSecret(cfg);
    const raw = await postForm(TOKEN_URL, {
      grant_type: "authorization_code",
      client_id: cfg.clientId,
      client_secret: clientSecret,
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: cfg.redirectUri,
    });
    return toTokenSet(raw);
  },
  profile: async (tokens: TokenSet) => {
    if (!tokens.idToken) {
      throw new Error("Apple token response missing id_token; cannot derive profile.");
    }
    const claims = decodeIdTokenPayload(tokens.idToken);
    const sub = claims.sub as string | undefined;
    if (!sub) {
      throw new Error("Apple id_token missing 'sub' claim; cannot derive user id.");
    }
    const profile: SocialProfile = {
      provider: "apple",
      id: sub,
      email: typeof claims.email === "string" ? claims.email : null,
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      name: null,
      picture: null,
      raw: claims,
    };
    return profile;
  },
});
