import { requireAuth } from "../../auth/index.ts";
import { from, raw } from "../../db/index.ts";
import type { PipeFn, Route } from "../../server/index.ts";
import { del, get, json, parseJson, pipe, pipeline, post, put } from "../../server/index.ts";
import { handleBulkAction } from "../actions/index.ts";
import type { AdminConfig } from "../config/index.ts";

export const generateRoutes = (config: AdminConfig): Route[] => {
  const routes: Route[] = [];
  const base = config.basePath ?? "/admin";
  const withAuth = config.auth
    ? (handler: PipeFn): PipeFn => pipeline(requireAuth(config.auth!))(handler)
    : (handler: PipeFn): PipeFn => handler;

  // Schema endpoint
  routes.push(
    get(
      `${base}/api/schema`,
      withAuth(
        pipe((c) => {
          const schemas = config.models.map((m) => ({
            table: m.schema.table,
            columns: Object.entries(m.schema.columns).map(([name, col]: [string, any]) => ({
              name,
              type: col.type,
              primary: col.primary,
              nullable: col.isNullable,
              unique: col.isUnique,
            })),
            listFields: m.listFields,
            searchFields: m.searchFields,
            filterFields: m.filterFields,
            actions: m.actions?.map((a) => ({ name: a.name, label: a.label })),
            bulkActions: m.bulkActions ?? ["delete"],
            readOnly: m.readOnly ?? false,
            relations: m.relations?.map((r) => ({
              table: r.schema.table,
              foreignKey: r.foreignKey,
              label: r.label,
            })),
          }));
          return json(c, 200, { models: schemas });
        }),
      ),
    ),
  );

  for (const modelCfg of config.models) {
    const table = modelCfg.schema.table;
    const prefix = `${base}/api/${table}`;

    // LIST
    routes.push(
      get(
        prefix,
        withAuth(
          pipe(async (c) => {
            const page = Number(c.query.page ?? "1");
            const limit = Math.min(Number(c.query.limit ?? "20"), 100);
            const offset = (page - 1) * limit;
            const sort = c.query.sort;
            const order = (c.query.order ?? "asc").toUpperCase() as "ASC" | "DESC";
            const search = c.query.search;

            // Build the where chain once and apply it to both the data query
            // and the count query so pagination metadata reflects the filtered
            // result set, not the whole table.
            const applyFilters = <T extends ReturnType<typeof from>>(q: T): T => {
              let next = q as any;
              if (search && modelCfg.searchFields?.length) {
                const fields = modelCfg.searchFields;
                next = next.where((b: any) => b.or(...fields.map((f) => b(f).like(`%${search}%`))));
              }
              if (modelCfg.filterFields) {
                for (const field of modelCfg.filterFields) {
                  const val = c.query[`filter.${field}`];
                  if (val !== undefined) {
                    next = next.where((b: any) => b(field).equals(val));
                  }
                }
              }
              return next as T;
            };

            let query = applyFilters(from(table));

            if (sort) {
              query = query.orderBy(sort, order);
            }

            if (modelCfg.listFields?.length) {
              query = query.select(...modelCfg.listFields);
            }

            const countQuery = applyFilters(from(table)).select(raw("count(*) as total"));
            const countResult = await config.db.one(countQuery);
            const total = countResult?.total ?? 0;

            const rows = await config.db.all(query.limit(limit).offset(offset));

            return json(c, 200, {
              data: rows,
              meta: { page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit) },
            });
          }),
        ),
      ),
    );

    // GET ONE
    routes.push(
      get(
        `${prefix}/:id`,
        withAuth(
          pipe(async (c) => {
            const row = await config.db.one(from(table).where((q) => q("id").equals(c.params.id)));
            if (!row) return json(c, 404, { error: "Not found" });
            return json(c, 200, { data: row });
          }),
        ),
      ),
    );

    if (!modelCfg.readOnly) {
      // CREATE
      routes.push(
        post(
          prefix,
          withAuth(
            pipeline(parseJson)(
              pipe(async (c) => {
                const data = c.body as Record<string, unknown>;
                const row = await config.db.one(from(table).insert(data).returning("*"));
                return json(c, 201, { data: row });
              }),
            ),
          ),
        ),
      );

      // UPDATE
      routes.push(
        put(
          `${prefix}/:id`,
          withAuth(
            pipeline(parseJson)(
              pipe(async (c) => {
                const data = c.body as Record<string, unknown>;
                const row = await config.db.one(
                  from(table)
                    .update(data)
                    .where((q) => q("id").equals(c.params.id))
                    .returning("*"),
                );
                if (!row) return json(c, 404, { error: "Not found" });
                return json(c, 200, { data: row });
              }),
            ),
          ),
        ),
      );

      // DELETE
      routes.push(
        del(
          `${prefix}/:id`,
          withAuth(
            pipe(async (c) => {
              await config.db.execute(
                from(table)
                  .del()
                  .where((q) => q("id").equals(c.params.id)),
              );
              return json(c, 200, { message: "Deleted" });
            }),
          ),
        ),
      );

      // BULK
      routes.push(
        post(
          `${prefix}/bulk`,
          withAuth(
            pipeline(parseJson)(
              pipe(async (c) => {
                const { action, ids } = c.body as { action: string; ids: (string | number)[] };
                return handleBulkAction(config.db, table, modelCfg, action, ids, c);
              }),
            ),
          ),
        ),
      );
    }

    // CUSTOM ACTIONS
    if (modelCfg.actions?.length) {
      routes.push(
        post(
          `${prefix}/action`,
          withAuth(
            pipeline(parseJson)(
              pipe(async (c) => {
                const { action, ids } = c.body as { action: string; ids: (string | number)[] };
                const actionDef = modelCfg.actions!.find((a) => a.name === action);
                if (!actionDef) return json(c, 400, { error: `Unknown action: ${action}` });
                const result = await actionDef.handler(config.db, ids);
                return json(c, 200, result);
              }),
            ),
          ),
        ),
      );
    }

    // RELATIONS
    if (modelCfg.relations?.length) {
      for (const rel of modelCfg.relations) {
        routes.push(
          get(
            `${prefix}/:id/relations/${rel.schema.table}`,
            withAuth(
              pipe(async (c) => {
                const rows = await config.db.all(
                  from(rel.schema.table).where((q) => q(rel.foreignKey).equals(c.params.id)),
                );
                return json(c, 200, { data: rows });
              }),
            ),
          ),
        );
      }
    }
  }

  return routes;
};
