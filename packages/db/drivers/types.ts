import type { Dialect, SqlResult } from "../types/index.ts";

export type Connection = {
  readonly dialect: Dialect;
  readonly execute: (query: { toSql: (dialect?: Dialect) => SqlResult } | SqlResult) => Promise<any[]>;
  readonly one: (query: { toSql: (dialect?: Dialect) => SqlResult } | SqlResult) => Promise<any | null>;
  readonly all: (query: { toSql: (dialect?: Dialect) => SqlResult } | SqlResult) => Promise<any[]>;
  readonly transaction: <T>(fn: (tx: Connection) => Promise<T>) => Promise<T>;
  readonly close: () => Promise<void>;
};

export type ConnectOptions = { driver: "postgres"; url: string; pool?: number } | { driver: "sqlite"; path: string };
