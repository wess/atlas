import type { Tool } from "./types.ts";
import { defineTool } from "./types.ts";

export const migrateTools: Tool[] = [
  defineTool({
    name: "migrate.status",
    description: "Show migration status — which migrations are applied and which are pending",
    inputSchema: { type: "object", properties: {} },
    handler: async (_params, ctx) => {
      const { status } = await import("@atlas/migrate");
      return await status(ctx.db!, ctx.migrationsDir);
    },
  }),
  defineTool({
    name: "migrate.up",
    description: "Run all pending migrations",
    inputSchema: { type: "object", properties: {} },
    handler: async (_params, ctx) => {
      const { up } = await import("@atlas/migrate");
      const ran = await up(ctx.db!, ctx.migrationsDir);
      return { applied: ran, count: ran.length };
    },
  }),
  defineTool({
    name: "migrate.down",
    description: "Rollback the most recent migration",
    inputSchema: { type: "object", properties: {} },
    handler: async (_params, ctx) => {
      const { down } = await import("@atlas/migrate");
      const rolled = await down(ctx.db!, ctx.migrationsDir);
      return { rolledBack: rolled };
    },
  }),
];
