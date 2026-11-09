import type { Connection } from "../../db/query.ts";

// a signed cookie stays valid until it expires, so sign-out needs a list of ids to refuse
export type Revocations = {
  readonly revoke: (jti: string, expiresAt: number) => Promise<void>;
  readonly isRevoked: (jti: string) => Promise<boolean>;
};

const now = () => Math.floor(Date.now() / 1000);

// single process only; entries leave once the cookie they block would have expired anyway
export const createMemoryRevocations = (opts: { maxEntries?: number } = {}): Revocations => {
  const maxEntries = opts.maxEntries ?? 100_000;
  const revoked = new Map<string, number>();
  const sweep = () => {
    const at = now();
    for (const [jti, expiresAt] of revoked) if (expiresAt <= at) revoked.delete(jti);
  };
  return {
    revoke: async (jti, expiresAt) => {
      if (revoked.size >= maxEntries) sweep();
      // refusing to record would leave a signed-out cookie working, so drop the oldest instead
      if (revoked.size >= maxEntries) revoked.delete(revoked.keys().next().value!);
      revoked.set(jti, expiresAt);
    },
    isRevoked: async (jti) => {
      const expiresAt = revoked.get(jti);
      if (expiresAt === undefined) return false;
      if (expiresAt > now()) return true;
      revoked.delete(jti);
      return false;
    },
  };
};

const identifier = /^[a-z_][a-z0-9_]*$/i;

// shared across processes; the table is created on first use
export const createDbRevocations = (opts: { db: Connection; table?: string }): Revocations => {
  const table = opts.table ?? "admin_revoked_sessions";
  if (!identifier.test(table)) throw new Error(`Invalid revocation table name: ${table}`);
  let ready: Promise<unknown> | undefined;
  const ensure = () => {
    ready ??= opts.db.execute({
      text: `CREATE TABLE IF NOT EXISTS ${table} (jti TEXT PRIMARY KEY, expires_at BIGINT NOT NULL)`,
      values: [],
    });
    return ready;
  };
  return {
    revoke: async (jti, expiresAt) => {
      await ensure();
      await opts.db.execute({
        text: `DELETE FROM ${table} WHERE expires_at <= ${opts.db.dialect === "postgres" ? "$1" : "?"}`,
        values: [now()],
      });
      await opts.db.execute({
        text:
          opts.db.dialect === "postgres"
            ? `INSERT INTO ${table} (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING`
            : `INSERT OR IGNORE INTO ${table} (jti, expires_at) VALUES (?, ?)`,
        values: [jti, expiresAt],
      });
    },
    isRevoked: async (jti) => {
      await ensure();
      const row = await opts.db.one({
        text: `SELECT 1 AS hit FROM ${table} WHERE jti = ${opts.db.dialect === "postgres" ? "$1" : "?"}`,
        values: [jti],
      });
      return row !== null;
    },
  };
};
