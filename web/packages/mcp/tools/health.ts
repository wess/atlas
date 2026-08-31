import type { Tool } from "./types.ts";
import { defineTool } from "./types.ts";

export const healthTools: Tool[] = [
  defineTool({
    name: "health.check",
    description: "Check connectivity to all configured services (database, cache, storage)",
    inputSchema: { type: "object", properties: {} },
    handler: async (_params, ctx) => {
      const checks: Record<string, string> = {};

      if (ctx.db) {
        try {
          await ctx.db.one({ text: "SELECT 1 as ok", values: [] });
          checks.database = "ok";
        } catch (e) {
          checks.database = `error: ${(e as Error).message}`;
        }
      }

      if (ctx.cache) {
        try {
          await ctx.cache.set("__health__", "ok", { ttl: 5 });
          const val = await ctx.cache.get("__health__");
          checks.cache = val === "ok" ? "ok" : "error: unexpected value";
          await ctx.cache.del("__health__");
        } catch (e) {
          checks.cache = `error: ${(e as Error).message}`;
        }
      }

      if (ctx.storage) {
        try {
          const res = await fetch(`${ctx.storage.endpoint}`);
          checks.storage = res.ok ? "ok" : `error: status ${res.status}`;
        } catch (e) {
          checks.storage = `error: ${(e as Error).message}`;
        }
      }

      return checks;
    },
  }),
];
