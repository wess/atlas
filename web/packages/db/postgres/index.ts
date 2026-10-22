import { connectPostgres } from "../drivers/postgres.ts";
import type { Connection } from "../drivers/types.ts";

export { connectPostgres } from "../drivers/postgres.ts";
export type { Connection } from "../drivers/types.ts";

export type PostgresOptions = { driver?: "postgres"; url: string; pool?: number };

export const connect = (options: PostgresOptions): Connection => connectPostgres(options.url, options.pool);
