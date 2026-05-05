import { compressResponse } from "../compress/index.ts";
import { matchHost, matchRoute } from "../match/index.ts";
import type { ForwardContext } from "../proxy/index.ts";
import type { Site } from "./types.ts";

const notFound = () => new Response("Not Found", { status: 404 });

export const dispatch = async (req: Request, ctx: ForwardContext, sites: ReadonlyArray<Site>): Promise<Response> => {
  const url = new URL(req.url);
  const site = sites.find((s) => matchHost(ctx.host, s.host));
  if (!site) return notFound();

  for (const route of site.routes) {
    if (!matchRoute(req, url, route.match)) continue;
    const res = await route.handler(req, ctx);
    if (site.compress && site.compress.length > 0) {
      return compressResponse(res, req.headers.get("accept-encoding"), site.compress);
    }
    return res;
  }
  return notFound();
};
