import type { Conn, PipeFn } from "../../server/index.ts";
import { halt, putHeader, redirect } from "../../server/index.ts";
import type { SocialProfile, SocialProvider, TokenSet } from "./providers/index.ts";
import {
  type CookieOptions,
  clearStateCookieHeader,
  createState,
  readStateCookie,
  setStateCookieHeader,
  verifyState,
} from "./state/index.ts";

export type SocialAuthConfig = {
  /** Secret used to sign the short-lived state JWT in the OAuth state cookie. */
  readonly secret: string;
  /** Map of provider name → constructed `SocialProvider`. */
  readonly providers: Readonly<Record<string, SocialProvider>>;
  /** Cookie tuning (name / path / secure / sameSite). */
  readonly cookie?: CookieOptions;
};

export type StartOptions = {
  /** Override the scopes from the provider's default set. */
  readonly scopes?: readonly string[];
  /** Where to send the user after a successful callback. Echoed in the state. */
  readonly returnTo?: string;
  /** Extra `?key=value` params appended to the authorize URL. */
  readonly extraParams?: Record<string, string>;
};

export type CallbackResult = {
  readonly provider: string;
  readonly tokens: TokenSet;
  readonly profile: SocialProfile;
  readonly returnTo?: string;
};

export type CallbackOptions = {
  /**
   * Called after a successful code exchange + profile fetch. Receives the
   * normalized profile, the raw token set, and the `returnTo` the caller
   * stashed in `start`. Return a `Conn` (e.g. via `json` or `redirect`) — the
   * package will not write a response on your behalf.
   */
  readonly onSuccess: (conn: Conn, result: CallbackResult) => Conn | Promise<Conn>;
  /** Optional error handler. Default: halt 400 with `{ error }`. */
  readonly onError?: (conn: Conn, error: Error) => Conn | Promise<Conn>;
};

export type SocialAuth = {
  readonly providers: Readonly<Record<string, SocialProvider>>;
  /** Pure: build the authorize URL + state cookie for `provider`. */
  readonly authorize: (provider: string, opts?: StartOptions) => Promise<{ url: string; cookie: string }>;
  /** Pure: exchange + fetch profile using state from `conn`. */
  readonly complete: (provider: string, conn: Conn) => Promise<CallbackResult>;
  /** PipeFn: set state cookie + 302 redirect to provider. */
  readonly start: (provider: string, opts?: StartOptions) => PipeFn;
  /** PipeFn: validate state, exchange code, fetch profile, hand to `onSuccess`. */
  readonly callback: (provider: string, opts: CallbackOptions) => PipeFn;
};

const getProvider = (cfg: SocialAuthConfig, name: string): SocialProvider => {
  const provider = cfg.providers[name];
  if (!provider) {
    throw new Error(
      `Unknown social provider '${name}'. Configured providers: [${Object.keys(cfg.providers).join(", ") || "<none>"}].`,
    );
  }
  return provider;
};

const codeFromConn = (conn: Conn): { code: string | null; state: string | null } => {
  const body = (conn.body && typeof conn.body === "object" ? conn.body : {}) as Record<string, unknown>;
  const code = (conn.query.code as string | undefined) ?? (typeof body.code === "string" ? body.code : null) ?? null;
  const state =
    (conn.query.state as string | undefined) ?? (typeof body.state === "string" ? body.state : null) ?? null;
  return { code, state };
};

const errorFromConn = (conn: Conn): string | null => {
  const body = (conn.body && typeof conn.body === "object" ? conn.body : {}) as Record<string, unknown>;
  return (conn.query.error as string | undefined) ?? (typeof body.error === "string" ? body.error : null) ?? null;
};

export const socialAuth = (cfg: SocialAuthConfig): SocialAuth => {
  const authorize = async (name: string, opts: StartOptions = {}): Promise<{ url: string; cookie: string }> => {
    const provider = getProvider(cfg, name);
    const { stateToken, codeChallenge } = await createState(cfg.secret, provider.name, opts.returnTo);
    const url = provider.authorizeUrl({
      state: stateToken,
      codeChallenge,
      scopes: opts.scopes,
      extraParams: opts.extraParams,
    });
    const cookie = setStateCookieHeader(stateToken, cfg.cookie);
    return { url, cookie };
  };

  const complete = async (name: string, conn: Conn): Promise<CallbackResult> => {
    const provider = getProvider(cfg, name);
    const providerError = errorFromConn(conn);
    if (providerError) {
      throw new Error(`Provider '${name}' returned error: ${providerError}`);
    }
    const { code, state } = codeFromConn(conn);
    if (!code) throw new Error("Missing 'code' on OAuth callback.");
    const cookieValue = readStateCookie(conn.headers.get("cookie"), cfg.cookie);
    const stateData = await verifyState(cfg.secret, cookieValue, state, provider.name);
    const tokens = await provider.exchange({ code, codeVerifier: stateData.codeVerifier });
    const profile = await provider.profile(tokens);
    return { provider: provider.name, tokens, profile, returnTo: stateData.returnTo };
  };

  const start =
    (name: string, opts?: StartOptions): PipeFn =>
    async (conn: Conn) => {
      const { url, cookie } = await authorize(name, opts);
      const withCookie = putHeader(conn, "set-cookie", cookie);
      return redirect(withCookie, url, 302);
    };

  const callback =
    (name: string, opts: CallbackOptions): PipeFn =>
    async (conn: Conn) => {
      try {
        const result = await complete(name, conn);
        const cleared = putHeader(conn, "set-cookie", clearStateCookieHeader(cfg.cookie));
        return await opts.onSuccess(cleared, result);
      } catch (err) {
        const cleared = putHeader(conn, "set-cookie", clearStateCookieHeader(cfg.cookie));
        const e = err instanceof Error ? err : new Error(String(err));
        if (opts.onError) return await opts.onError(cleared, e);
        return halt(cleared, 400, { error: e.message });
      }
    };

  return { providers: cfg.providers, authorize, complete, start, callback };
};

export type {
  AppleConfig,
  AuthorizeParams,
  ExchangeParams,
  FacebookConfig,
  GithubConfig,
  GoogleConfig,
  MicrosoftConfig,
  SocialProfile,
  SocialProvider,
  TiktokConfig,
  TokenSet,
  TwitterConfig,
} from "./providers/index.ts";
export { apple, facebook, github, google, microsoft, tiktok, twitter } from "./providers/index.ts";
export type { CookieOptions } from "./state/index.ts";
