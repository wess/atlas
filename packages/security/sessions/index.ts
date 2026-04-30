import { randomUUID } from "node:crypto";
import { token } from "@atlas/auth";
import type { Connection } from "@atlas/db";
import { from } from "@atlas/db";

export type SessionContext = {
  readonly ip?: string | null;
  readonly userAgent?: string | null;
};

export type IssuedSession = {
  readonly token: string;
  readonly jti: string;
  readonly expiresAt: Date;
};

export type SessionStatus = {
  readonly active: boolean;
  readonly userId?: number | string;
};

export type SessionStore<TUser extends { id: number | string }> = {
  /** Mint a new JWT and persist a session row tied to its `jti`. */
  readonly issue: (user: TUser, ctx?: SessionContext) => Promise<IssuedSession>;
  /** Returns active=false for missing, expired, or revoked sessions. */
  readonly isActive: (jti: string) => Promise<SessionStatus>;
  /** Bump `last_used_at` to the current time. Fire-and-forget — never throws. */
  readonly touch: (jti: string) => void;
  /** Revoke a single session (must belong to the given user). Returns true if it was active. */
  readonly revoke: (jti: string, userId: TUser["id"]) => Promise<boolean>;
  /** Revoke every active session for a user, optionally keeping one (e.g. the current one). */
  readonly revokeAll: (userId: TUser["id"], exceptJti?: string) => Promise<number>;
  /** Delete every session whose `expires_at` is in the past. */
  readonly sweepExpired: () => Promise<void>;
};

export type SessionStoreOptions<TUser extends { id: number | string }> = {
  readonly db: Connection;
  readonly secret: string;
  /** Override the table name. Default: `sessions`. */
  readonly table?: string;
  /** TTL in seconds. Default: 7 days. */
  readonly ttlSeconds?: number;
  /**
   * Build the JWT claims payload from the user. The library always merges in
   * `{ jti }` regardless of what you return.
   */
  readonly payload?: (user: TUser) => Record<string, unknown>;
};

const DEFAULT_TABLE = "sessions";
const DEFAULT_TTL = 86400 * 7;

/**
 * DB-backed session store. The JWT itself stays stateless, but the `jti`
 * inside it is bound to a row whose `revoked_at` lets you kill a session
 * server-side (logout-everywhere, suspicious-activity revoke, etc.).
 *
 * Schema:
 *   CREATE TABLE sessions (
 *     id            TEXT PRIMARY KEY,             -- the jti
 *     user_id       INTEGER NOT NULL,
 *     ip            TEXT NULL,
 *     user_agent    TEXT NULL,
 *     created_at    TIMESTAMPTZ DEFAULT NOW(),
 *     last_used_at  TIMESTAMPTZ NULL,
 *     expires_at    TIMESTAMPTZ NOT NULL,
 *     revoked_at    TIMESTAMPTZ NULL
 *   );
 */
export const createSessionStore = <TUser extends { id: number | string }>(
  opts: SessionStoreOptions<TUser>,
): SessionStore<TUser> => {
  const table = opts.table ?? DEFAULT_TABLE;
  const ttl = opts.ttlSeconds ?? DEFAULT_TTL;
  const buildPayload = opts.payload ?? ((u: TUser) => ({ ...u }) as Record<string, unknown>);

  return {
    issue: async (user, ctx = {}) => {
      const jti = randomUUID();
      const expiresAt = new Date(Date.now() + ttl * 1000);
      const jwt = await token.sign({ ...buildPayload(user), jti }, opts.secret, { expiresIn: ttl });
      await opts.db.execute(
        from(table).insert({
          id: jti,
          user_id: user.id,
          ip: ctx.ip ?? null,
          user_agent: ctx.userAgent?.slice(0, 256) ?? null,
          expires_at: expiresAt.toISOString(),
        }),
      );
      return { token: jwt, jti, expiresAt };
    },

    isActive: async (jti) => {
      const row = (await opts.db.one(
        from(table)
          .where((q) => q("id").equals(jti))
          .select("user_id", "expires_at", "revoked_at"),
      )) as { user_id: number | string; expires_at: string; revoked_at: string | null } | null;
      if (!row) return { active: false };
      if (row.revoked_at) return { active: false, userId: row.user_id };
      if (new Date(row.expires_at).getTime() < Date.now()) return { active: false, userId: row.user_id };
      return { active: true, userId: row.user_id };
    },

    touch: (jti) => {
      void opts.db
        .execute(
          from(table)
            .where((q) => q("id").equals(jti))
            .update({ last_used_at: new Date().toISOString() }),
        )
        .catch(() => {});
    },

    revoke: async (jti, userId) => {
      const rows = (await opts.db.execute(
        from(table)
          .where((q) => q("id").equals(jti))
          .where((q) => q("user_id").equals(userId))
          .where((q) => q("revoked_at").isNull())
          .update({ revoked_at: new Date().toISOString() })
          .returning("id"),
      )) as Array<{ id: string }>;
      return rows.length > 0;
    },

    revokeAll: async (userId, exceptJti) => {
      let q = from(table)
        .where((p) => p("user_id").equals(userId))
        .where((p) => p("revoked_at").isNull());
      if (exceptJti) q = q.where((p) => p("id").notEquals(exceptJti));
      const rows = (await opts.db.execute(
        q.update({ revoked_at: new Date().toISOString() }).returning("id"),
      )) as Array<{
        id: string;
      }>;
      return rows.length;
    },

    sweepExpired: async () => {
      try {
        await opts.db.execute(
          from(table)
            .where((q) => q("expires_at").lessThan(new Date().toISOString()))
            .del(),
        );
      } catch (err) {
        console.error("[sessions] sweep failed:", err);
      }
    },
  };
};

/** Random URL-safe identifier suitable for a `jti`. */
export const newJti = (): string => randomUUID();
