import { connectPostgres } from "./postgres.ts";
import { connectSqlite } from "./sqlite.ts";
import type { Connection, ConnectOptions } from "./types.ts";

export const connect = (options: ConnectOptions): Connection => {
  switch (options.driver) {
    case "postgres":
      return connectPostgres(options.url, options.pool);
    case "sqlite":
      return connectSqlite(options.path);
    default:
      throw new Error(
        `Unknown database driver: "${(options as any).driver}". Supported drivers are "postgres" and "sqlite". Example: connect({ driver: "sqlite", path: ":memory:" })`,
      );
  }
};

export type { Connection, ConnectOptions };
