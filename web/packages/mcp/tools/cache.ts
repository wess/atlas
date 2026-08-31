import type { Tool } from "./types.ts";
import { defineTool } from "./types.ts";

export const cacheTools: Tool[] = [
  defineTool({
    name: "cache.get",
    description: "Get a value from the cache by key",
    inputSchema: {
      type: "object",
      properties: { key: { type: "string", description: "Cache key" } },
      required: ["key"],
    },
    handler: async (params, ctx) => {
      const value = await ctx.cache!.get(params.key as string);
      return { key: params.key, value };
    },
  }),
  defineTool({
    name: "cache.set",
    description: "Set a value in the cache",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string" },
        value: { type: "string", description: "JSON string value" },
        ttl: { type: "number", description: "TTL in seconds (optional)" },
      },
      required: ["key", "value"],
    },
    handler: async (params, ctx) => {
      const value = JSON.parse(params.value as string);
      const ttl = params.ttl as number | undefined;
      await ctx.cache!.set(params.key as string, value, ttl ? { ttl } : undefined);
      return { ok: true };
    },
  }),
  defineTool({
    name: "cache.del",
    description: "Delete a cache key",
    inputSchema: {
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"],
    },
    handler: async (params, ctx) => {
      await ctx.cache!.del(params.key as string);
      return { ok: true };
    },
  }),
  defineTool({
    name: "cache.flush",
    description: "Flush all cache entries",
    inputSchema: { type: "object", properties: {} },
    handler: async (_params, ctx) => {
      await ctx.cache!.flush();
      return { ok: true };
    },
  }),
];
