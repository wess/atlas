export type ProxyOptions = {
  readonly upstream: string;
  readonly preserveHost?: boolean;
  /**
   * Keep the client's X-Forwarded-For/Forwarded and append to them. Only for an
   * edge that itself sits behind a proxy you control (a load balancer, a CDN);
   * otherwise any client can claim any address. Default false.
   */
  readonly trustForwarded?: boolean;
};

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

const stripHopByHop = (headers: Headers): Headers => {
  const nominated = new Set((headers.get("connection") ?? "").split(",").map((v) => v.trim().toLowerCase()));
  const out = new Headers();
  headers.forEach((v, k) => {
    if (k !== "set-cookie" && !HOP_BY_HOP.has(k.toLowerCase()) && !nominated.has(k.toLowerCase())) out.set(k, v);
  });
  if (!nominated.has("set-cookie")) for (const cookie of headers.getSetCookie()) out.append("set-cookie", cookie);
  return out;
};

// Headers a client could set to impersonate an upstream proxy. As the
// outermost hop the edge is the only party that knows the real peer, so it
// discards these and reports what it saw itself.
const CLIENT_FORWARDING = ["forwarded", "x-forwarded-port", "x-forwarded-prefix"];

const setForwardedFor = (h: Headers, ip: string, trust: boolean): void => {
  if (!trust) {
    for (const name of CLIENT_FORWARDING) h.delete(name);
    h.set("x-forwarded-for", ip);
    return;
  }
  const prior = h.get("x-forwarded-for");
  h.set("x-forwarded-for", prior ? `${prior}, ${ip}` : ip);
};

export type ForwardContext = {
  readonly remoteIp: string;
  readonly tls: boolean;
  readonly host: string;
};

export const forward = async (req: Request, options: ProxyOptions, ctx: ForwardContext): Promise<Response> => {
  const incoming = new URL(req.url);
  const target = new URL(options.upstream);
  // Preserve the request's path + query, only swap origin.
  const finalUrl = new URL(target);
  finalUrl.pathname = incoming.pathname;
  finalUrl.search = incoming.search;
  finalUrl.hash = "";

  const headers = stripHopByHop(req.headers);
  headers.set("x-real-ip", ctx.remoteIp);
  setForwardedFor(headers, ctx.remoteIp, options.trustForwarded === true);
  headers.set("x-forwarded-proto", ctx.tls ? "https" : "http");
  headers.set("x-forwarded-host", ctx.host);
  if (!options.preserveHost) headers.set("host", target.host);

  const init: RequestInit & { decompress: boolean } = {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    redirect: "manual",
    signal: req.signal,
    decompress: false,
  };

  // Bun supports streaming request bodies through fetch; ensure duplex hint
  // for non-GET/HEAD.
  if (init.body) (init as { duplex?: string }).duplex = "half";

  const upstream = await fetch(finalUrl, init);
  const respHeaders = stripHopByHop(upstream.headers);
  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
};

export const proxy =
  (upstream: string, opts: { preserveHost?: boolean; trustForwarded?: boolean } = {}) =>
  async (req: Request, ctx: ForwardContext): Promise<Response> =>
    forward(req, { upstream, preserveHost: opts.preserveHost, trustForwarded: opts.trustForwarded }, ctx);
