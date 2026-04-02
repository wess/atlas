import type { Connection, Schema } from "@atlas/db";
import type { PipeFn } from "@atlas/server";
import { pipe } from "@atlas/server";
import { generateQueryRoutes } from "../query/index.ts";
import { generateRoutes } from "../routes/index.ts";
import { adminHtml } from "../ui/shell.ts";

export type CustomAction<T = unknown> = {
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
  readonly auth?: { secret: string };
};

export const model = (config: ModelConfig): ModelConfig => config;

const htmlResponse = (
  conn: { status: number; body: unknown; halted: boolean; respHeaders: Headers } & Record<string, unknown>,
  html: string,
) => ({
  ...conn,
  status: 200,
  body: html,
  halted: true,
  respHeaders: (() => {
    const h = new Headers(conn.respHeaders);
    h.set("content-type", "text/html; charset=utf-8");
    return h;
  })(),
});

export const admin = (config: AdminConfig) => {
  const crudRoutes = generateRoutes(config);
  const queryRoutes = generateQueryRoutes(config);
  const base = config.basePath ?? "/admin";
  const shell = adminHtml(base);

  const spaRoute: PipeFn = pipe((c) => htmlResponse(c, shell));

  const allRoutes: Record<string, PipeFn> = {
    ...crudRoutes,
    ...queryRoutes,
    [`GET ${base}`]: spaRoute,
    [`GET ${base}/*`]: spaRoute,
  };

  return {
    routes: allRoutes,
    mount: (existingRoutes: Record<string, PipeFn>) => ({
      ...existingRoutes,
      ...allRoutes,
    }),
  };
};
