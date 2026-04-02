import { SQL } from "bun";
import type { Dialect, SqlResult } from "../types/index.ts";
import type { Connection } from "./types.ts";

const toSqlResult = (query: { toSql: (dialect?: Dialect) => SqlResult } | SqlResult): SqlResult =>
  "toSql" in query && typeof query.toSql === "function" ? query.toSql("postgres") : (query as SqlResult);

const makeConnection = (sql: InstanceType<typeof SQL>, isTx = false): Connection => ({
  dialect: "postgres",

  execute: async (query) => {
    const { text, values } = toSqlResult(query);
    const rows = await sql.unsafe(text, values as any[]);
    return Array.from(rows);
  },

  one: async (query) => {
    const { text, values } = toSqlResult(query);
    const rows = await sql.unsafe(text, values as any[]);
    return rows.length > 0 ? rows[0] : null;
  },

  all: async (query) => {
    const { text, values } = toSqlResult(query);
    const rows = await sql.unsafe(text, values as any[]);
    return Array.from(rows);
  },

  transaction: async <T>(fn: (tx: Connection) => Promise<T>): Promise<T> =>
    sql.begin(async (tx: any) => fn(makeConnection(tx, true))),

  close: async () => {
    if (!isTx) await sql.close();
  },
});

export const connectPostgres = (url: string, pool?: number): Connection =>
  makeConnection(new SQL({ url, max: pool ?? 5 }));
