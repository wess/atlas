import { connectSqlite } from "../drivers/sqlite.ts";
import type { Connection } from "../drivers/types.ts";

export { connectSqlite } from "../drivers/sqlite.ts";
export type { Connection } from "../drivers/types.ts";

export type SqliteOptions = { driver?: "sqlite"; path: string };

export const connect = (options: SqliteOptions): Connection => connectSqlite(options.path);
