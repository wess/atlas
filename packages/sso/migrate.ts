import type { Connection } from "../db/index.ts";

/**
 * Create the transient state table @atlas/sso uses to bridge the
 * /login → /callback redirect. Idempotent. Call once at boot before
 * `mountSso(...)` serves traffic.
 */
export const ensureSsoStateTable = async (db: Connection, table = "sso_state"): Promise<void> => {
  const text =
    `CREATE TABLE IF NOT EXISTS ${table} (` +
    `  state TEXT PRIMARY KEY,` +
    `  verifier TEXT NOT NULL,` +
    `  nonce TEXT NOT NULL,` +
    `  return_to TEXT NOT NULL DEFAULT '/',` +
    `  expires_at TIMESTAMPTZ NOT NULL,` +
    `  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` +
    `)`;
  await db.execute({ text, values: [] });
};
