import type { Connection, Schema } from "../../db/query.ts";
import type { RateLimit } from "../../security/ratelimit/index.ts";
import type { Conn, PipeFn, Route } from "../../server/index.ts";
import { get, halt, pipe, putHeader } from "../../server/index.ts";
import { generateQueryRoutes } from "../query/index.ts";
import { generateRoutes } from "../routes/index.ts";
import { generateSessionRoutes } from "../session/index.ts";
import { type AdminAssets, loadAdminAssets } from "../ui/assets.ts";
import { adminHtml } from "../ui/shell.ts";

export type CustomAction<_T = unknown> = {
  readonly name: string;
  readonly label: string;
  readonly handler: (db: Connection, ids: (string | number)[]) => Promise<{ message: string }>;
};

export type BulkAction = "delete" | "export";

export type RelationConfig = {
  readonly schema: Schema;
  readonly foreignKey: string;
  readonly label?: string;
};

export type ModelConfig = {
  readonly schema: Schema;
  readonly listFields?: string[];
  readonly searchFields?: string[];
  readonly filterFields?: string[];
  readonly relations?: RelationConfig[];
  readonly actions?: CustomAction[];
  readonly bulkActions?: BulkAction[];
  readonly readOnly?: boolean;
};

export type AdminConfig = {
  readonly db: Connection;
  readonly models: ModelConfig[];
  readonly basePath?: string;
  readonly allowUnauthenticated?: boolean;
  readonly auth?: {
    secret: string;
    authorize: (claims: Record<string, unknown>) => boolean | Promise<boolean>;
    /** Checks credentials for the sign-in screen and returns token claims, or null. Without it the admin only accepts Bearer tokens. */
    login?: (credentials: {
      email: string;
      password: string;
    }) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
    /** Signed-in session length in seconds. Default: 8 hours. */
    sessionSeconds?: number;
    /** Login attempt limiter. Pass createDbRateLimit when running more than one process. Default: in-memory. */
    rateLimit?: RateLimit;
    /** Extra origins allowed to write with a session cookie, for a proxy that rewrites the Host header. */
    trustedOrigins?: string[];
  };
};

export const model = (config: ModelConfig): ModelConfig => config;

const htmlResponse = (conn: Conn, html: string): Conn =>
  putHeader(halt(conn, 200, html), "content-type", "text/html; charset=utf-8");

export const admin = (config: AdminConfig) => {
  const crudRoutes = generateRoutes(config);
  const queryRoutes = generateQueryRoutes(config);
  const base = config.basePath ?? "/admin";
  const shell = adminHtml(base);

  const spaRoute: PipeFn = pipe((c) => htmlResponse(c, shell));

  // built once on first request; a failed build is not cached, so the next request can retry
  let pending: Promise<AdminAssets> | undefined;
  const assets = () => {
    pending ??= loadAdminAssets().catch((error) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
  const assetRoute: PipeFn = pipe(async (c) => {
    const asset = (await assets())[c.params.name ?? ""];
    if (!asset) return halt(c, 404, { error: "Not found" });
    return putHeader(putHeader(halt(c, 200, asset.body), "content-type", asset.type), "cache-control", "no-cache");
  });
  const unknownApi: PipeFn = pipe((c) => halt(c, 404, { error: "Not found" }));

  // the wildcard is the client router's: every other path under base is a screen it can resolve
  const allRoutes: Route[] = [
    ...crudRoutes,
    ...queryRoutes,
    ...generateSessionRoutes(config),
    get(`${base}/assets/:name`, assetRoute),
    get(`${base}/api/*`, unknownApi),
    get(base, spaRoute),
    get(`${base}/*`, spaRoute),
  ];

  return {
    routes: allRoutes,
    mount: (existingRoutes: Route[]) => [...existingRoutes, ...allRoutes],
  };
};
