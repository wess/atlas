import type { Connection } from "@atlas/db";
import { from } from "@atlas/db";

export type AuditEvent = {
  readonly userId?: number | string | null;
  readonly event: string;
  readonly metadata?: Record<string, unknown>;
  readonly ip?: string | null;
  readonly userAgent?: string | null;
};

export type AuditLogger = {
  /** Fire-and-forget: never throws, never blocks the response. */
  readonly log: (ev: AuditEvent) => void;
};

export type AuditOptions = {
  readonly db: Connection;
  /** Override the table name. Default: `audit_events`. */
  readonly table?: string;
  /** Hook for callers who want to surface failures (default: console.error). */
  readonly onError?: (err: unknown, ev: AuditEvent) => void;
};

const DEFAULT_TABLE = "audit_events";

/**
 * Schema:
 *   CREATE TABLE audit_events (
 *     id           SERIAL PRIMARY KEY,    -- INTEGER on SQLite
 *     user_id      INTEGER NULL,
 *     event        TEXT NOT NULL,
 *     metadata     TEXT NULL,             -- JSON-encoded
 *     ip           TEXT NULL,
 *     user_agent   TEXT NULL,
 *     created_at   TIMESTAMPTZ DEFAULT NOW()
 *   );
 */
export const createAuditLogger = (opts: AuditOptions): AuditLogger => {
  const table = opts.table ?? DEFAULT_TABLE;
  const onError = opts.onError ?? ((err, ev) => console.error("[audit] failed to log:", ev.event, err));

  return {
    log: (ev) => {
      void opts.db
        .execute(
          from(table).insert({
            user_id: ev.userId ?? null,
            event: ev.event,
            metadata: ev.metadata ? JSON.stringify(ev.metadata) : null,
            ip: ev.ip ?? null,
            user_agent: ev.userAgent ?? null,
          }),
        )
        .catch((err) => onError(err, ev));
    },
  };
};
