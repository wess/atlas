import * as token from "../../token/index.ts";

const STATE_TTL_SECONDS = 600;

const b64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");

export const randomNonce = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
};

export const generateCodeVerifier = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
};

export const computeCodeChallenge = async (verifier: string): Promise<string> => {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return b64url(new Uint8Array(hash));
};

export type StatePayload = {
  readonly provider: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly returnTo?: string;
};

export type CreatedState = {
  readonly stateToken: string;
  readonly codeVerifier: string;
  readonly codeChallenge: string;
  readonly nonce: string;
};

export const createState = async (secret: string, provider: string, returnTo?: string): Promise<CreatedState> => {
  const nonce = randomNonce();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await computeCodeChallenge(codeVerifier);
  const stateToken = await token.sign({ provider, nonce, codeVerifier, ...(returnTo ? { returnTo } : {}) }, secret, {
    expiresIn: STATE_TTL_SECONDS,
  });
  return { stateToken, codeVerifier, codeChallenge, nonce };
};

export const verifyState = async (
  secret: string,
  cookieValue: string | null,
  stateParam: string | null,
  expectedProvider: string,
): Promise<StatePayload> => {
  if (!cookieValue) {
    throw new Error(
      "Missing OAuth state cookie. The browser dropped or never received the state cookie set by /start.",
    );
  }
  if (!stateParam) {
    throw new Error("Missing 'state' query parameter on the OAuth callback.");
  }
  if (cookieValue !== stateParam) {
    throw new Error("OAuth state mismatch. The state cookie and 'state' query parameter must be identical.");
  }
  const payload = (await token.verify(cookieValue, secret)) as StatePayload & {
    iat?: number;
    exp?: number;
  };
  if (payload.provider !== expectedProvider) {
    throw new Error(
      `OAuth state provider mismatch: state was issued for '${payload.provider}' but callback hit '${expectedProvider}'.`,
    );
  }
  return {
    provider: payload.provider,
    nonce: payload.nonce,
    codeVerifier: payload.codeVerifier,
    returnTo: payload.returnTo,
  };
};

export type CookieOptions = {
  readonly name?: string;
  readonly path?: string;
  readonly secure?: boolean;
  readonly sameSite?: "lax" | "strict" | "none";
};

const DEFAULT_COOKIE_NAME = "_atlas_oauth_state";

export const setStateCookieHeader = (stateToken: string, opts: CookieOptions = {}): string => {
  const name = opts.name ?? DEFAULT_COOKIE_NAME;
  const path = opts.path ?? "/";
  const sameSite = opts.sameSite ?? "lax";
  const secure = opts.secure ?? true;
  const parts = [
    `${name}=${stateToken}`,
    `Path=${path}`,
    "HttpOnly",
    `SameSite=${sameSite}`,
    `Max-Age=${STATE_TTL_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
};

export const clearStateCookieHeader = (opts: CookieOptions = {}): string => {
  const name = opts.name ?? DEFAULT_COOKIE_NAME;
  const path = opts.path ?? "/";
  const sameSite = opts.sameSite ?? "lax";
  const secure = opts.secure ?? true;
  const parts = [`${name}=`, `Path=${path}`, "HttpOnly", `SameSite=${sameSite}`, "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
};

export const readStateCookie = (cookieHeader: string | null, opts: CookieOptions = {}): string | null => {
  if (!cookieHeader) return null;
  const name = opts.name ?? DEFAULT_COOKIE_NAME;
  for (const segment of cookieHeader.split(/;\s*/)) {
    const eq = segment.indexOf("=");
    if (eq < 0) continue;
    if (segment.slice(0, eq) === name) return segment.slice(eq + 1);
  }
  return null;
};
