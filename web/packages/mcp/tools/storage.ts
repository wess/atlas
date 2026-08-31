import type { Tool } from "./types.ts";
import { defineTool } from "./types.ts";

export const storageTools: Tool[] = [
  defineTool({
    name: "storage.list",
    description: "List files in storage with optional prefix filter",
    inputSchema: {
      type: "object",
      properties: { prefix: { type: "string", description: "Key prefix to filter by (optional)" } },
    },
    handler: async (params, ctx) => {
      const { createStore, list } = await import("@atlas/storage");
      const store = createStore(ctx.storage!);
      try {
        const files = await list(store, params.prefix as string | undefined);
        return { files };
      } catch (e) {
        return { error: (e as Error).message };
      }
    },
  }),
  defineTool({
    name: "storage.presign",
    description: "Generate a presigned URL for a storage key",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Storage key/path" },
        expires: { type: "number", description: "URL expiry in seconds (default 3600)" },
      },
      required: ["key"],
    },
    handler: async (params, ctx) => {
      const { createStore, presign } = await import("@atlas/storage");
      const store = createStore(ctx.storage!);
      const url = presign(store, params.key as string, { expires: (params.expires as number) ?? 3600 });
      return { url };
    },
  }),
];
