import type { Connection } from "@atlas/db";
import type { Cache } from "@atlas/cache";
import type { Route } from "@atlas/server";

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
