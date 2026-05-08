import { Database } from "bun:sqlite";
import type { SqlResult } from "../types/index.ts";
import type { Connection, QueryInput } from "./types.ts";

const toSqlResult = <Row>(query: QueryInput<Row>): SqlResult<Row> =>
  "toSql" in query && typeof query.toSql === "function" ? query.toSql("sqlite") : (query as SqlResult<Row>);

const isSelect = (text: string): boolean => {
  const trimmed = text.trimStart().toUpperCase();
  return trimmed.startsWith("SELECT") || trimmed.includes("RETURNING");
};

const makeConnection = (db: Database): Connection => ({
  dialect: "sqlite",

  execute: async <Row>(query: QueryInput<Row>): Promise<Row[]> => {
    const { text, values } = toSqlResult(query);
    if (isSelect(text)) {
      return db.prepare(text).all(...(values as any[])) as Row[];
    }
    db.prepare(text).run(...(values as any[]));
    return [];
  },

  one: async <Row>(query: QueryInput<Row>): Promise<Row | null> => {
    const { text, values } = toSqlResult(query);
    const row = db.prepare(text).get(...(values as any[]));
    return (row ?? null) as Row | null;
  },

  all: async <Row>(query: QueryInput<Row>): Promise<Row[]> => {
    const { text, values } = toSqlResult(query);
    return db.prepare(text).all(...(values as any[])) as Row[];
  },

  transaction: async <T>(fn: (tx: Connection) => Promise<T>): Promise<T> => {
    db.run("BEGIN");
    try {
      const result = await fn(makeConnection(db));
      db.run("COMMIT");
      return result;
    } catch (err) {
      db.run("ROLLBACK");
      throw err;
    }
  },

  close: async () => {
    db.close();
  },
});

export const connectSqlite = (path: string): Connection => {
  const db = new Database(path);
  db.run("PRAGMA journal_mode = WAL");
  return makeConnection(db);
};
