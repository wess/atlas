export type SocialProfile = {
  readonly provider: string;
  readonly id: string;
  readonly email?: string | null;
  readonly emailVerified?: boolean;
  readonly name?: string | null;
  readonly picture?: string | null;
  readonly username?: string | null;
  readonly raw: Record<string, unknown>;
};

export type TokenSet = {
  readonly accessToken: string;
  readonly tokenType?: string;
  readonly expiresIn?: number;
  readonly refreshToken?: string;
  readonly idToken?: string;
  readonly scope?: string;
  readonly raw: Record<string, unknown>;
};

export type AuthorizeParams = {
  readonly state: string;
  readonly codeChallenge: string;
  readonly scopes?: readonly string[];
  readonly extraParams?: Record<string, string>;
};

export type ExchangeParams = {
  readonly code: string;
  readonly codeVerifier: string;
};

/**
 * A pluggable social-login provider. Implementations are stateless — all
 * per-deployment configuration is the `TConfig` they're constructed with.
 */
export type SocialProvider<TConfig = unknown> = {
  readonly name: string;
  readonly config: TConfig;
  readonly defaultScopes: readonly string[];
  readonly authorizeUrl: (params: AuthorizeParams) => string;
  readonly exchange: (params: ExchangeParams) => Promise<TokenSet>;
  readonly profile: (tokens: TokenSet) => Promise<SocialProfile>;
};

export type { AppleConfig } from "./apple/index.ts";
export { apple } from "./apple/index.ts";
export type { FacebookConfig } from "./facebook/index.ts";
export { facebook } from "./facebook/index.ts";
export type { GithubConfig } from "./github/index.ts";
export { github } from "./github/index.ts";
export type { GoogleConfig } from "./google/index.ts";
export { google } from "./google/index.ts";
export type { MicrosoftConfig } from "./microsoft/index.ts";
export { microsoft } from "./microsoft/index.ts";
export type { TiktokConfig } from "./tiktok/index.ts";
export { tiktok } from "./tiktok/index.ts";
export type { TwitterConfig } from "./twitter/index.ts";
export { twitter } from "./twitter/index.ts";
