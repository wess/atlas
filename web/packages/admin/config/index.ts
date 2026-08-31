import type { Connection, Schema } from "../../db/index.ts";
import type { Conn, PipeFn, Route } from "../../server/index.ts";
import { get, halt, pipe, putHeader } from "../../server/index.ts";
import { generateQueryRoutes } from "../query/index.ts";
import { generateRoutes } from "../routes/index.ts";
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
  readonly auth?: { secret: string };
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

  const allRoutes: Route[] = [...crudRoutes, ...queryRoutes, get(base, spaRoute), get(`${base}/*`, spaRoute)];

  return {
    routes: allRoutes,
    mount: (existingRoutes: Route[]) => [...existingRoutes, ...allRoutes],
  };
};
