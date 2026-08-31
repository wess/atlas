// Strict default headers + Content-Security-Policy. Production CSP is deny-by-
// default and same-origin-only; the dev variant relaxes script and connect
// sources to accommodate Bun's HMR runtime. Both opt out of framing entirely.

const CSP_PROD =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; " +
  "font-src 'self' data:; " +
  "connect-src 'self'; " +
  "media-src 'self' blob:; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "frame-ancestors 'none'";

const CSP_DEV =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; " +
  "font-src 'self' data:; " +
  "connect-src 'self' ws: wss: http: https:; " +
  "media-src 'self' blob:; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "frame-ancestors 'none'";

const DEFAULT_HEADERS: Readonly<Record<string, string>> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-site",
};

// Bun.serve passes a `server` argument exposing the raw socket peer via
// `server.requestIP(req)`. We stash that on the request so downstream code
// (rate-limit buckets, audit logs) reads the real peer rather than trusting
// X-Forwarded-For from the client.
type BunServer = { readonly requestIP?: (req: Request) => { readonly address: string } | null };

export type SecurityHeadersOptions = {
  /** Override the entire Content-Security-Policy header. */
  readonly csp?: string;
  /** When true, the dev CSP (allowing HMR / inline) is used. Default: false. */
  readonly dev?: boolean;
  /** Disable CSP entirely (e.g. for an API-only origin). */
  readonly disableCsp?: boolean;
  /** Extra headers merged after defaults. */
  readonly headers?: Readonly<Record<string, string>>;
};

export type Fetch = (req: Request, server?: BunServer) => Response | Promise<Response>;

export const withSecurityHeaders =
  (fetch: (req: Request) => Response | Promise<Response>, opts: SecurityHeadersOptions = {}): Fetch =>
  async (req, server) => {
    if (server?.requestIP) {
      const peer = server.requestIP(req);
      if (peer?.address) {
        (req as { peerIp?: string }).peerIp = peer.address;
      }
    }
    const res = await fetch(req);
    const merged: Record<string, string> = { ...DEFAULT_HEADERS, ...(opts.headers ?? {}) };
    if (!opts.disableCsp) {
      merged["content-security-policy"] = opts.csp ?? (opts.dev ? CSP_DEV : CSP_PROD);
    }
    for (const [k, v] of Object.entries(merged)) {
      if (!res.headers.has(k)) res.headers.set(k, v);
    }
    return res;
  };

/** The default production CSP string, exported for callers who want to extend it. */
export const productionCsp = CSP_PROD;
/** The default development CSP string. */
export const developmentCsp = CSP_DEV;
