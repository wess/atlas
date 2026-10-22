import { z } from "zod";
import { from } from "../../db/query.ts";
import type { Route } from "../../server/index.ts";
import { json, parseJson, pipe, pipeline, post } from "../../server/index.ts";
import { adminAuth } from "../auth/index.ts";
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

const payloadSchema = z.object({
  table: z.string(),
  select: z.array(z.string()).max(100).optional(),
  filters: z
    .array(
      z.object({
        field: z.string(),
        op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "null", "notnull"]),
        value: z.unknown().optional(),
      }),
    )
    .max(100)
    .optional(),
  sort: z.object({ field: z.string(), direction: z.enum(["asc", "desc"]) }).optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).optional(),
  groupBy: z.array(z.string()).max(100).optional(),
});

const validatePayload = (body: unknown, config: AdminConfig): QueryPayload | null => {
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return null;
  const payload = parsed.data;
  const model = config.models.find((item) => item.schema.table === payload.table);
  if (!model) return null;
  const fields = new Set(Object.keys(model.schema.columns));
  const selected = [
    ...(payload.select ?? []),
    ...(payload.groupBy ?? []),
    ...(payload.filters ?? []).map((filter) => filter.field),
    ...(payload.sort ? [payload.sort.field] : []),
  ];
  if (selected.some((field) => !fields.has(field))) return null;
  if (
    payload.filters?.some(
      (filter) => filter.op === "in" && (!Array.isArray(filter.value) || filter.value.length > 1000),
    )
  )
    return null;
  return payload;
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

export const generateQueryRoutes = (config: AdminConfig): Route[] => {
  const base = config.basePath ?? "/admin";
  const withAuth = adminAuth(config);

  return [
    post(
      `${base}/api/query`,
      withAuth(
        pipeline(parseJson)(
          pipe(async (c) => {
            const payload = validatePayload(c.body, config);
            if (!payload)
              return json(c, 400, { error: "Invalid query: use registered tables and fields with a limit of 1–1000" });

            const query = buildQuery(payload);
            const sql = query.toSql(config.db.dialect);
            const rows = await config.db.all(query);

            return json(c, 200, { data: rows, sql: sql.text, params: sql.values });
          }),
        ),
      ),
    ),

    post(
      `${base}/api/query/preview`,
      withAuth(
        pipeline(parseJson)(
          pipe(async (c) => {
            const payload = validatePayload(c.body, config);
            if (!payload)
              return json(c, 400, { error: "Invalid query: use registered tables and fields with a limit of 1–1000" });

            const query = buildQuery(payload);
            const sql = query.toSql(config.db.dialect);

            return json(c, 200, { sql: sql.text, params: sql.values });
          }),
        ),
      ),
    ),
  ];
};
