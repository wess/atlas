import { Database, type Statement } from "bun:sqlite";
import type { SqlResult } from "../types/index.ts";
import type { Connection, QueryInput } from "./types.ts";

const toSqlResult = <Row>(query: QueryInput<Row>): SqlResult<Row> =>
  "toSql" in query && typeof query.toSql === "function" ? query.toSql("sqlite") : (query as SqlResult<Row>);

type Schedule = <T>(fn: () => T | Promise<T>) => Promise<T>;

export const connectSqlite = (path: string): Connection => {
  const db = new Database(path);
  db.run("PRAGMA journal_mode = WAL");
  const statements = new Map<string, Statement>();
  let queue = Promise.resolve();
  let savepoint = 0;

  const schedule: Schedule = async (fn) => {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  };
  const immediate: Schedule = async (fn) => fn();
  const statement = (text: string): Statement => {
    const cached = statements.get(text);
    if (cached) return cached;
    if (statements.size >= 256) {
      const oldest = statements.keys().next().value!;
      statements.get(oldest)!.finalize();
      statements.delete(oldest);
    }
    const prepared = db.prepare(text);
    statements.set(text, prepared);
    return prepared;
  };

  const connection = (run: Schedule, nested = false): Connection => {
    const all = <Row>(query: QueryInput<Row>): Promise<Row[]> =>
      run(() => {
        const { text, values } = toSqlResult(query);
        return statement(text).all(...values) as Row[];
      });
    return {
      dialect: "sqlite",
      execute: all,
      all,
      one: <Row>(query: QueryInput<Row>): Promise<Row | null> =>
        run(() => {
          const { text, values } = toSqlResult(query);
          return (statement(text).get(...values) ?? null) as Row | null;
        }),
      transaction: <T>(fn: (tx: Connection) => Promise<T>): Promise<T> =>
        run(async () => {
          const name = `atlas${++savepoint}`;
          db.run(nested ? `SAVEPOINT ${name}` : "BEGIN");
          try {
            const result = await fn(connection(immediate, true));
            db.run(nested ? `RELEASE SAVEPOINT ${name}` : "COMMIT");
            return result;
          } catch (err) {
            db.run(nested ? `ROLLBACK TO SAVEPOINT ${name}` : "ROLLBACK");
            if (nested) db.run(`RELEASE SAVEPOINT ${name}`);
            throw err;
          }
        }),
      close: () =>
        run(() => {
          for (const prepared of statements.values()) prepared.finalize();
          statements.clear();
          db.close();
        }),
    };
  };
  return connection(schedule);
};
