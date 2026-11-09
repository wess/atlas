import { Database } from "bun:sqlite"
import { tool } from "@wess/atlas/ai"
import type { AgentTool } from "@wess/atlas/ai"
import { config } from "../config.ts"

// The model never writes SQL here. A "SELECT only" check on model-written SQL can still read
// password hashes, other people's conversations, or run a query that blocks the server, and
// bun:sqlite has no way to interrupt a statement. So the model picks a table from this list and
// an optional search term; the columns and query shape are fixed and the values are bound.
// users and conversations are left out on purpose. Add a table here only if every account may
// read every row of it.
const readable: Record<string, { columns: readonly string[]; search: readonly string[] }> = {
  documents: { columns: ["id", "title", "content", "created_at"], search: ["title", "content"] },
}

const maxRows = 20
const maxCellLength = 500

const path = config.databaseUrl.replace(/^sqlite:\/\//, "")

const truncate = (value: unknown) =>
  typeof value === "string" && value.length > maxCellLength ? `${value.slice(0, maxCellLength)}…` : value

export const databaseTool: AgentTool = {
  definition: tool("query_database", "Look up rows in an application table, optionally filtered by a search term", {
    type: "object",
    properties: {
      table: { type: "string", enum: Object.keys(readable) },
      search: { type: "string", description: "Case-insensitive text to look for" },
      limit: { type: "number", description: `Rows to return, at most ${maxRows}` },
    },
    required: ["table"],
  }),
  handler: async (args: Record<string, unknown>) => {
    const table = typeof args.table === "string" && Object.hasOwn(readable, args.table) ? args.table : null
    const spec = table ? readable[table] : undefined
    if (!table || !spec) return `Error: table must be one of ${Object.keys(readable).join(", ")}`

    const search = typeof args.search === "string" ? args.search.slice(0, 100) : ""
    const limit = Math.min(Math.max(Math.trunc(Number(args.limit)) || 10, 1), maxRows)

    const filter = search ? `where ${spec.search.map((c) => `instr(lower(${c}), lower(?)) > 0`).join(" or ")}` : ""
    const sql = `select ${spec.columns.join(", ")} from ${table} ${filter} order by id desc limit ?`
    const values = [...(search ? spec.search.map(() => search) : []), limit]

    try {
      // A separate read-only connection, so nothing this tool runs can write.
      using reader = new Database(path, { readonly: true })
      const rows = reader.query(sql).all(...values) as Record<string, unknown>[]
      return JSON.stringify(rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, truncate(v)]))))
    } catch (err) {
      return `Error: ${(err as Error).message}`
    }
  },
}
