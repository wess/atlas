import type { Connection } from "../../db/index.ts";

export type RateLimitResult = {
  readonly ok: boolean;
  readonly count: number;
  readonly retryAfterSeconds: number;
};

export type RateLimit = {
  readonly check: (bucket: string, max: number, windowSeconds: number) => Promise<RateLimitResult>;
  readonly reset: (bucket: string) => Promise<void>;
};

// In-memory limiter. Single-process only — fine for dev / tests / single-node
// services, but not suitable for horizontally-scaled deployments where every
// instance would track its own counters.
export const createMemoryRateLimit = (): RateLimit => {
  const buckets = new Map<string, { count: number; startedAt: number }>();
  return {
    check: async (bucket, max, windowSeconds) => {
      const now = Math.floor(Date.now() / 1000);
      const existing = buckets.get(bucket);
      if (!existing || now - existing.startedAt >= windowSeconds) {
        buckets.set(bucket, { count: 1, startedAt: now });
        return { ok: true, count: 1, retryAfterSeconds: 0 };
      }
      existing.count += 1;
      const elapsed = now - existing.startedAt;
      const retryAfter = Math.min(windowSeconds, Math.max(1, windowSeconds - elapsed));
      return existing.count <= max
        ? { ok: true, count: existing.count, retryAfterSeconds: 0 }
        : { ok: false, count: existing.count, retryAfterSeconds: retryAfter };
    },
    reset: async (bucket) => {
      buckets.delete(bucket);
    },
  };
};

const DEFAULT_TABLE = "rate_limits";

const pgSql = (table: string): string => `
INSERT INTO ${table} (bucket, count, window_started_at)
VALUES ($1, 1, NOW())
ON CONFLICT (bucket) DO UPDATE SET
  count = CASE
    WHEN ${table}.window_started_at < NOW() - ($2 || ' seconds')::interval THEN 1
    ELSE ${table}.count + 1
  END,
  window_started_at = CASE
    WHEN ${table}.window_started_at < NOW() - ($2 || ' seconds')::interval THEN NOW()
    ELSE ${table}.window_started_at
  END
RETURNING count, EXTRACT(EPOCH FROM window_started_at)::bigint AS started
`;

// SQLite path uses two statements inside a transaction. UPSERT alone can't
// conditionally reset the window without re-running the same CASE in two
// places, and the result of UPSERT in sqlite returns the inserted/updated row
// without the previous value, so we read first and decide in JS.
const createSqliteImpl =
  (db: Connection, table: string): RateLimit["check"] =>
  async (bucket, max, windowSeconds) => {
    const result = await db.transaction(async (tx) => {
      const existing = (await tx.one({
        text: `SELECT count, window_started_at FROM ${table} WHERE bucket = ?`,
        values: [bucket],
      })) as { count: number; window_started_at: string | number } | null;

      const now = Math.floor(Date.now() / 1000);
      const startedAt = existing
        ? typeof existing.window_started_at === "number"
          ? existing.window_started_at
          : Math.floor(new Date(existing.window_started_at).getTime() / 1000)
        : now;
      const expired = !existing || now - startedAt >= windowSeconds;
      const nextCount = expired ? 1 : existing.count + 1;
      const nextStart = expired ? now : startedAt;

      if (existing) {
        await tx.execute({
          text: `UPDATE ${table} SET count = ?, window_started_at = ? WHERE bucket = ?`,
          values: [nextCount, nextStart, bucket],
        });
      } else {
        await tx.execute({
          text: `INSERT INTO ${table} (bucket, count, window_started_at) VALUES (?, ?, ?)`,
          values: [bucket, nextCount, nextStart],
        });
      }
      return { count: nextCount, startedAt: nextStart };
    });

    if (result.count <= max) return { ok: true, count: result.count, retryAfterSeconds: 0 };
    const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - result.startedAt);
    const retryAfter = Math.min(windowSeconds, Math.max(1, windowSeconds - elapsed));
    return { ok: false, count: result.count, retryAfterSeconds: retryAfter };
  };

const createPostgresImpl =
  (db: Connection, table: string): RateLimit["check"] =>
  async (bucket, max, windowSeconds) => {
    const rows = (await db.execute({
      text: pgSql(table),
      values: [bucket, String(windowSeconds)],
    })) as Array<{ count: number; started: number | string | bigint }>;
    const row = rows[0];
    const count = Number(row?.count ?? 0);
    if (count <= max) return { ok: true, count, retryAfterSeconds: 0 };
    // Postgres' EXTRACT(EPOCH FROM ...)::bigint rounds rather than floors, so
    // the returned start can be one tick ahead of Date.now()/1000. Clamp it.
    const startedSec = Number(row?.started ?? 0);
    const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - startedSec);
    const retryAfter = Math.min(windowSeconds, Math.max(1, windowSeconds - elapsed));
    return { ok: false, count, retryAfterSeconds: retryAfter };
  };

export type DbRateLimitOptions = {
  readonly db: Connection;
  /** Override the table name. Default: `rate_limits`. */
  readonly table?: string;
};

/**
 * Database-backed rate limiter. Schema:
 *   CREATE TABLE rate_limits (
 *     bucket TEXT PRIMARY KEY,
 *     count INTEGER NOT NULL,
 *     window_started_at TIMESTAMPTZ NOT NULL  -- INTEGER (unix seconds) on SQLite
 *   );
 */
export const createDbRateLimit = (opts: DbRateLimitOptions): RateLimit => {
  const table = opts.table ?? DEFAULT_TABLE;
  const check = opts.db.dialect === "postgres" ? createPostgresImpl(opts.db, table) : createSqliteImpl(opts.db, table);
  return {
    check,
    reset: async (bucket) => {
      const sql =
        opts.db.dialect === "postgres"
          ? { text: `DELETE FROM ${table} WHERE bucket = $1`, values: [bucket] }
          : { text: `DELETE FROM ${table} WHERE bucket = ?`, values: [bucket] };
      await opts.db.execute(sql);
    },
  };
};

// IPv4 trusted-proxy parsing. CIDR matching only — IPv6 callers should pass
// peer addresses through unchanged. Single addresses match exactly; CIDRs
// match by prefix length.
type Cidr = { readonly addr: number; readonly mask: number; readonly bits: number };

const ipv4ToInt = (ip: string): number | null => {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
};

const parseCidr = (raw: string): Cidr | null => {
  const [ip, prefix] = raw.includes("/") ? raw.split("/") : [raw, "32"];
  const bits = Number(prefix);
  if (!ip || !Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  const addr = ipv4ToInt(ip);
  if (addr === null) return null;
  const mask = bits === 0 ? 0 : ~((1 << (32 - bits)) - 1) >>> 0;
  return { addr: (addr & mask) >>> 0, mask, bits };
};

/**
 * Parse a comma-separated list of `1.2.3.4` or `1.2.3.0/24` strings into a
 * matcher list. Invalid entries are silently dropped.
 */
export const parseTrustedProxies = (raw: string | null | undefined): readonly Cidr[] =>
  (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseCidr)
    .filter((c): c is Cidr => c !== null);

const ipInTrusted = (ip: string, trusted: readonly Cidr[]): boolean => {
  if (trusted.length === 0) return false;
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return trusted.some((c) => (n & c.mask) >>> 0 === c.addr);
};

// `withSecurityHeaders` (from @atlas/security/headers) stashes the Bun socket
// peer onto the request as `req.peerIp`. Fall back to "unknown" when it is
// not set — e.g. tests without the wrapper, or non-Bun runtimes.
const peerIp = (req: Request): string => (req as { peerIp?: string }).peerIp ?? "unknown";

export type ClientIpOptions = {
  /** CIDRs of trusted reverse proxies, parsed via `parseTrustedProxies`. */
  readonly trustedProxies?: readonly Cidr[];
};

/**
 * The real client IP for rate-limit / audit purposes. Honors X-Forwarded-For
 * and X-Real-IP only when the request actually arrived from a configured
 * trusted proxy — otherwise the header is attacker-supplied and would let a
 * remote client pin or spoof per-IP buckets.
 */
export const clientIp = (req: Request, opts: ClientIpOptions = {}): string => {
  const peer = peerIp(req);
  const trusted = opts.trustedProxies ?? [];
  if (ipInTrusted(peer, trusted)) {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) {
      // Left-most address is the original client per RFC 7239.
      const first = fwd.split(",")[0]?.trim();
      if (first) return first;
    }
    const real = req.headers.get("x-real-ip");
    if (real) return real;
  }
  return peer;
};

export const userAgent = (req: Request): string => (req.headers.get("user-agent") ?? "").slice(0, 256);
