import { Database } from "bun:sqlite";
import type { Dialect, SqlResult } from "../types/index.ts";
import type { Connection } from "./types.ts";

const toSqlResult = (query: { toSql: (dialect?: Dialect) => SqlResult } | SqlResult): SqlResult =>
  "toSql" in query && typeof query.toSql === "function" ? query.toSql("sqlite") : (query as SqlResult);

const isSelect = (text: string): boolean => {
  const trimmed = text.trimStart().toUpperCase();
  return trimmed.startsWith("SELECT") || trimmed.includes("RETURNING");
};

const makeConnection = (db: Database): Connection => ({
  dialect: "sqlite",

  execute: async (query) => {
    const { text, values } = toSqlResult(query);
    if (isSelect(text)) {
      return db.prepare(text).all(...values);
    }
    db.prepare(text).run(...values);
    return [];
  },

  one: async (query) => {
    const { text, values } = toSqlResult(query);
    const row = db.prepare(text).get(...values);
    return row ?? null;
  },

  all: async (query) => {
    const { text, values } = toSqlResult(query);
    return db.prepare(text).all(...values);
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
