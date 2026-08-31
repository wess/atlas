import type { Tool } from "./types.ts";
import { defineTool } from "./types.ts";

export const dbTools: Tool[] = [
  defineTool({
    name: "db.query",
    description:
      "Execute a SQL query against the database. Returns rows as JSON. Use parameterized queries for safety.",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL query to execute" },
        params: { type: "string", description: "JSON array of query parameters (optional)" },
      },
      required: ["sql"],
    },
    handler: async (params, ctx) => {
      const sql = params.sql as string;
      const values = params.params ? (JSON.parse(params.params as string) as unknown[]) : [];
      const rows = await ctx.db!.all({ text: sql, values });
      return { rows, count: rows.length };
    },
  }),
  defineTool({
    name: "db.schemas",
    description: "List all tables and their columns in the database",
    inputSchema: { type: "object", properties: {} },
    handler: async (_params, ctx) => {
      if (ctx.db!.dialect === "sqlite") {
        const tables = await ctx.db!.all({
          text: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          values: [],
        });
        const result: Record<string, unknown[]> = {};
        for (const t of tables) {
          const cols = await ctx.db!.all({ text: `PRAGMA table_info(${(t as any).name})`, values: [] });
          result[(t as any).name] = cols;
        }
        return result;
      }
      const tables = await ctx.db!.all({
        text: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
        values: [],
      });
      const result: Record<string, unknown[]> = {};
      for (const t of tables) {
        const cols = await ctx.db!.all({
          text: "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1",
          values: [(t as any).table_name],
        });
        result[(t as any).table_name] = cols;
      }
      return result;
    },
  }),
];
