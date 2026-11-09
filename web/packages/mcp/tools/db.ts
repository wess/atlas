import type { Connection, SqlResult } from "../../db/query.ts";
import type { Tool } from "./types.ts";
import { defineTool } from "./types.ts";

const LEADING_NOISE = /^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/|\()*/;
const READ_KEYWORDS = new Set(["select", "with", "explain", "values", "table", "show"]);

/** First keyword of a statement, past whitespace, comments, and opening parens. */
export const leadingKeyword = (sql: string): string =>
  (sql.replace(LEADING_NOISE, "").match(/^[a-z]+/i)?.[0] ?? "").toLowerCase();

export const isReadStatement = (sql: string): boolean => READ_KEYWORDS.has(leadingKeyword(sql));

// Shaped like a builder query so the Postgres driver sends it as one prepared
// statement even with no values: "SELECT 1; COMMIT; DROP TABLE x" is refused
// instead of escaping the read-only transaction.
const single = (text: string, values: unknown[]) => ({ toSql: (): SqlResult => ({ text, values }) });

const readOnly = async (db: Connection, text: string, values: unknown[]): Promise<unknown[]> => {
  if (db.dialect === "postgres") {
    return db.transaction(async (tx) => {
      await tx.execute({ text: "SET TRANSACTION READ ONLY", values: [] });
      return tx.all(single(text, values));
    });
  }
  // SQLite has no read-only transaction; it prepares only the first statement,
  // and query_only makes the engine itself refuse writes while this runs.
  return db.transaction(async (tx) => {
    await tx.execute({ text: "PRAGMA query_only = ON", values: [] });
    try {
      return await tx.all(single(text, values));
    } finally {
      await tx.execute({ text: "PRAGMA query_only = OFF", values: [] });
    }
  });
};

export const dbTools: Tool[] = [
  defineTool({
    name: "db.query",
    description:
      "Run a read-only SQL query (SELECT, WITH, EXPLAIN) and return rows as JSON. Writes are refused unless the server was started with writes allowed (ATLAS_MCP_ALLOW_WRITES=1).",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "One SQL statement" },
        params: { type: "string", description: "JSON array of query parameters (optional)" },
      },
      required: ["sql"],
    },
    handler: async (params, ctx) => {
      const sql = params.sql as string;
      const values = params.params ? (JSON.parse(params.params as string) as unknown[]) : [];
      if (ctx.allowWrites) {
        const rows = await ctx.db!.all({ text: sql, values });
        return { rows, count: rows.length };
      }
      if (!isReadStatement(sql)) {
        throw new Error(
          "db.query is read-only: only SELECT, WITH, and EXPLAIN statements are allowed. Start the MCP server with ATLAS_MCP_ALLOW_WRITES=1 to permit writes.",
        );
      }
      const rows = await readOnly(ctx.db!, sql, values);
      return { rows, count: rows.length };
    },
  }),
  defineTool({
    name: "db.schemas",
    description: "List all tables and their columns in the database",
    annotations: { readOnlyHint: true },
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
