import { requireAuth } from "@atlas/auth";
import { from } from "@atlas/db";
import type { PipeFn } from "@atlas/server";
import { json, parseJson, pipe, pipeline } from "@atlas/server";
import type { AdminConfig } from "../config/index.ts";

export type QueryFilter = {
  readonly field: string;
  readonly op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in" | "null" | "notnull";
  readonly value?: unknown;
};

export type QueryPayload = {
  readonly table: string;
  readonly select?: string[];
  readonly filters?: QueryFilter[];
  readonly sort?: { field: string; direction: "asc" | "desc" };
  readonly limit?: number;
  readonly offset?: number;
  readonly groupBy?: string[];
};

const applyFilters = (query: any, filters: QueryFilter[]) => {
  let q = query;
  for (const filter of filters) {
    q = q.where((wb: any) => {
      const col = wb(filter.field);
      switch (filter.op) {
        case "eq":
          return col.equals(filter.value);
        case "neq":
          return col.notEquals(filter.value);
        case "gt":
          return col.greaterThan(filter.value);
        case "gte":
          return col.greaterThanOrEqual(filter.value);
        case "lt":
          return col.lessThan(filter.value);
        case "lte":
          return col.lessThanOrEqual(filter.value);
        case "like":
          return col.like(filter.value);
        case "ilike":
          return col.ilike(filter.value);
        case "in":
          return col.inList(filter.value as any[]);
        case "null":
          return col.isNull();
        case "notnull":
          return col.isNotNull();
        default:
          return col.equals(filter.value);
      }
    });
  }
  return q;
};

const buildQuery = (payload: QueryPayload) => {
  let query = from(payload.table);

  if (payload.select?.length) {
    query = query.select(...payload.select);
  }

  if (payload.filters?.length) {
    query = applyFilters(query, payload.filters);
  }

  if (payload.sort) {
    query = query.orderBy(payload.sort.field, payload.sort.direction.toUpperCase() as "ASC" | "DESC");
  }

  if (payload.groupBy?.length) {
    query = query.groupBy(...payload.groupBy);
  }

  if (payload.limit) query = query.limit(payload.limit);
  if (payload.offset) query = query.offset(payload.offset);

  return query;
};

export const generateQueryRoutes = (config: AdminConfig): Record<string, PipeFn> => {
  const base = config.basePath ?? "/admin";
  const withAuth = config.auth
    ? (handler: PipeFn): PipeFn => pipeline(requireAuth(config.auth!))(handler)
    : (handler: PipeFn): PipeFn => handler;

  return {
    [`POST ${base}/api/query`]: withAuth(
      pipeline(parseJson)(
        pipe(async (c) => {
          const payload = c.body as QueryPayload;
          const modelCfg = config.models.find((m) => m.schema.table === payload.table);
          if (!modelCfg) return json(c, 400, { error: `Unknown table: ${payload.table}` });

          const query = buildQuery(payload);
          const sql = query.toSql(config.db.dialect);
          const rows = await config.db.all(query);

          return json(c, 200, { data: rows, sql: sql.text, params: sql.values });
        }),
      ),
    ),

    [`POST ${base}/api/query/preview`]: withAuth(
      pipeline(parseJson)(
        pipe(async (c) => {
          const payload = c.body as QueryPayload;
          const modelCfg = config.models.find((m) => m.schema.table === payload.table);
          if (!modelCfg) return json(c, 400, { error: `Unknown table: ${payload.table}` });

          const query = buildQuery(payload);
          const sql = query.toSql(config.db.dialect);

          return json(c, 200, { sql: sql.text, params: sql.values });
        }),
      ),
    ),
  };
};
