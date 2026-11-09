import { SQL } from "bun";
import type { Dialect, SqlResult } from "../types/index.ts";
import type { Connection, QueryInput } from "./types.ts";

const isBuilder = <Row>(query: QueryInput<Row>): query is { readonly toSql: (dialect?: Dialect) => SqlResult<Row> } =>
  "toSql" in query && typeof query.toSql === "function";

// A one-string template object, so Bun's tagged-template path sends `text`
// unchanged. Bun only accepts it when `raw` is non-enumerable.
const template = (text: string): TemplateStringsArray => {
  const strings = [text];
  Object.defineProperty(strings, "raw", { value: [text] });
  return Object.freeze(strings) as unknown as TemplateStringsArray;
};

// sql.unsafe(text, []) uses Postgres's simple query protocol, which runs every
// statement in `text`; with values it uses a prepared statement, which allows
// exactly one. Builder output is always a single statement, so a builder query
// with no values is sent through the tagged-template (prepared) path too: if
// anything smuggled a second statement into it, Postgres refuses instead of
// running it. Plain { text, values } objects keep the simple protocol because
// migrations and hand-written scripts rely on multi-statement text.
const run = async <Row>(sql: InstanceType<typeof SQL>, query: QueryInput<Row>): Promise<Row[]> => {
  if (isBuilder(query)) {
    const { text, values } = query.toSql("postgres");
    const rows = values.length === 0 ? await sql(template(text)) : await sql.unsafe(text, values as any[]);
    return Array.from(rows) as Row[];
  }
  const { text, values } = query as SqlResult<Row>;
  return Array.from(await sql.unsafe(text, values as any[])) as Row[];
};

const makeConnection = (sql: InstanceType<typeof SQL>, isTx = false): Connection => ({
  dialect: "postgres",

  execute: <Row>(query: QueryInput<Row>): Promise<Row[]> => run<Row>(sql, query),

  one: async <Row>(query: QueryInput<Row>): Promise<Row | null> => {
    const rows = await run<Row>(sql, query);
    return rows.length > 0 ? (rows[0] as Row) : null;
  },

  all: <Row>(query: QueryInput<Row>): Promise<Row[]> => run<Row>(sql, query),

  transaction: async <T>(fn: (tx: Connection) => Promise<T>): Promise<T> =>
    isTx
      ? (sql as any).savepoint(async (sp: any) => fn(makeConnection(sp, true)))
      : sql.begin(async (tx: any) => fn(makeConnection(tx, true))),

  close: async () => {
    if (!isTx) await sql.close();
  },
});

export const connectPostgres = (url: string, pool?: number): Connection =>
  makeConnection(new SQL({ url, max: pool ?? 5 }));
