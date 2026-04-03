import { tool } from "@atlas/ai"
import type { AgentTool } from "@atlas/ai"
import { db } from "../db.ts"

export const databaseTool: AgentTool = {
  definition: tool("query_database", "Run a read-only SQL query against the database", {
    type: "object",
    properties: { sql: { type: "string", description: "SELECT query to run" } },
    required: ["sql"],
  }),
  handler: async (args: Record<string, unknown>) => {
    const sql = (args.sql as string).trim()
    if (!sql.toUpperCase().startsWith("SELECT")) {
      return "Error: only SELECT queries are allowed"
    }
    try {
      const rows = await db.query(sql)
      return JSON.stringify(rows)
    } catch (err) {
      return `Error: ${(err as Error).message}`
    }
  },
}
