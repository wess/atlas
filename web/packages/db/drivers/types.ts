import type { Dialect, SqlResult } from "../types/index.ts";

// A query input is either a Chainable-shaped object with toSql(), or a raw SqlResult.
// The phantom row type carried on either propagates through to the Promise.
export type QueryInput<Row = unknown> = { readonly toSql: (dialect?: Dialect) => SqlResult<Row> } | SqlResult<Row>;

export type Connection = {
  readonly dialect: Dialect;
  readonly execute: <Row = unknown>(query: QueryInput<Row>) => Promise<Row[]>;
  readonly one: <Row = unknown>(query: QueryInput<Row>) => Promise<Row | null>;
  readonly all: <Row = unknown>(query: QueryInput<Row>) => Promise<Row[]>;
  readonly transaction: <T>(fn: (tx: Connection) => Promise<T>) => Promise<T>;
  readonly close: () => Promise<void>;
};

export type ConnectOptions = { driver: "postgres"; url: string; pool?: number } | { driver: "sqlite"; path: string };
