export type ProxyOptions = {
  readonly upstream: string;
  readonly preserveHost?: boolean;
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

const appendForwardedFor = (h: Headers, ip: string): void => {
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
  appendForwardedFor(headers, ctx.remoteIp);
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
  (upstream: string, opts: { preserveHost?: boolean } = {}) =>
  async (req: Request, ctx: ForwardContext): Promise<Response> =>
    forward(req, { upstream, preserveHost: opts.preserveHost }, ctx);
