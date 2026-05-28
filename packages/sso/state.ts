import { from } from "../db/index.ts";
import type { Connection } from "../db/index.ts";

/**
 * The transient row that survives the redirect dance between
 * `/auth/sso/login` and `/auth/sso/callback`. Holds the PKCE verifier so
 * the IdP can't be MitM'd into accepting a swapped code.
 */
export type StateRow = {
  readonly state: string;
  readonly verifier: string;
  readonly nonce: string;
  readonly return_to: string;
  readonly expires_at: string;
};

const STATE_TTL_MS = 10 * 60 * 1000;

export const writeState = async (
  db: Connection,
  table: string,
  row: { state: string; verifier: string; nonce: string; returnTo: string },
): Promise<void> => {
  await db.execute(
    from(table).insert({
      state: row.state,
      verifier: row.verifier,
      nonce: row.nonce,
      return_to: row.returnTo,
      expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    }),
  );
};

/**
 * Atomic single-use: delete-and-return so a replay attempt finds nothing.
 */
export const consumeState = async (
  db: Connection,
  table: string,
  state: string,
): Promise<StateRow | null> => {
  const rows = (await db.execute(
    from(table).where((q) => q("state").equals(state)).del().returning("state", "verifier", "nonce", "return_to", "expires_at"),
  )) as StateRow[];
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
};

export const sweepExpiredSsoState = async (db: Connection, table = "sso_state"): Promise<number> => {
  const rows = (await db.execute(
    from(table).where((q) => q("expires_at").lessThan(new Date().toISOString())).del().returning("state"),
  )) as { state: string }[];
  return rows.length;
};
