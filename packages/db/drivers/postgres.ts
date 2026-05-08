import { SQL } from "bun";
import type { SqlResult } from "../types/index.ts";
import type { Connection, QueryInput } from "./types.ts";

const toSqlResult = <Row>(query: QueryInput<Row>): SqlResult<Row> =>
  "toSql" in query && typeof query.toSql === "function" ? query.toSql("postgres") : (query as SqlResult<Row>);

const makeConnection = (sql: InstanceType<typeof SQL>, isTx = false): Connection => ({
  dialect: "postgres",

  execute: async <Row>(query: QueryInput<Row>): Promise<Row[]> => {
    const { text, values } = toSqlResult(query);
    const rows = await sql.unsafe(text, values as any[]);
    return Array.from(rows) as Row[];
  },

  one: async <Row>(query: QueryInput<Row>): Promise<Row | null> => {
    const { text, values } = toSqlResult(query);
    const rows = await sql.unsafe(text, values as any[]);
    return (rows.length > 0 ? rows[0] : null) as Row | null;
  },

  all: async <Row>(query: QueryInput<Row>): Promise<Row[]> => {
    const { text, values } = toSqlResult(query);
    const rows = await sql.unsafe(text, values as any[]);
    return Array.from(rows) as Row[];
  },

  transaction: async <T>(fn: (tx: Connection) => Promise<T>): Promise<T> =>
    sql.begin(async (tx: any) => fn(makeConnection(tx, true))),

  close: async () => {
    if (!isTx) await sql.close();
  },
});

export const connectPostgres = (url: string, pool?: number): Connection =>
  makeConnection(new SQL({ url, max: pool ?? 5 }));
