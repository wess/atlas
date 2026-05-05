export type RouteMatcher = {
  readonly path?: RegExp | string;
  readonly method?: string | ReadonlyArray<string>;
};

export const matchRoute = (req: Request, url: URL, m: RouteMatcher | undefined): boolean => {
  if (!m) return true;
  if (m.method) {
    const methods = typeof m.method === "string" ? [m.method] : m.method;
    if (!methods.some((x) => x.toUpperCase() === req.method.toUpperCase())) return false;
  }
  if (m.path) {
    if (typeof m.path === "string") {
      if (m.path.endsWith("*")) {
        if (!url.pathname.startsWith(m.path.slice(0, -1))) return false;
      } else if (url.pathname !== m.path) return false;
    } else if (!m.path.test(url.pathname)) return false;
  }
  return true;
};

// Match the SNI host (request URL's host) against a site spec. Supports literal
// equality and a leading wildcard (e.g. "*.example.com"). Localhost matches
// "localhost" and any "*.localhost" subdomain.
export const matchHost = (host: string, pattern: string): boolean => {
  const h = host.toLowerCase().split(":")[0]!;
  const p = pattern.toLowerCase();
  if (p === h) return true;
  if (p.startsWith("*.")) {
    const tail = p.slice(2);
    return h.endsWith(`.${tail}`);
  }
  return false;
};

export const isLocalHost = (host: string): boolean => {
  const lower = host.toLowerCase();
  if (lower === "::1" || lower === "[::1]") return true;
  const h = lower.split(":")[0]!;
  return h === "localhost" || h.endsWith(".localhost") || h === "127.0.0.1";
};
