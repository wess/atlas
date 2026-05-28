import type { Cache } from "../../cache/index.ts";
import type { Connection } from "../../db/index.ts";
import type { Route } from "../../server/index.ts";

export type AtlasMcpContext = {
  readonly db?: Connection;
  readonly cache?: Cache;
  readonly routes?: Route[];
  readonly config?: Record<string, unknown>;
  readonly storage?: { endpoint: string; bucket: string; accessKey: string; secretKey: string; region: string };
  readonly migrationsDir?: string;
  readonly logBuffer?: string[];
};

export const createContext = (opts: Partial<AtlasMcpContext> = {}): AtlasMcpContext => ({
  ...opts,
  logBuffer: opts.logBuffer ?? [],
});
