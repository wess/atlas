import { from } from "@atlas/db";
import { type OAuthConfig, resolveTables } from "../types.ts";

/**
 * Cleanup helpers for the periodic table-sweeping cron. Auth codes are
 * 60-second TTL, device codes 10-minute, refresh tokens 30-day — none are
 * useful past their `expires_at`. Run these on a schedule (e.g. once an hour).
 */
export const sweepExpiredAuthCodes = async (cfg: OAuthConfig): Promise<void> => {
  const tables = resolveTables(cfg);
  try {
    await cfg.db.execute(
      from(tables.authorizationCodes)
        .where((q) => q("expires_at").lessThan(new Date().toISOString()))
        .del(),
    );
  } catch (err) {
    console.error("[oauth] auth-code sweep failed:", err);
  }
};

export const sweepExpiredDeviceCodes = async (cfg: OAuthConfig): Promise<void> => {
  const tables = resolveTables(cfg);
  try {
    await cfg.db.execute(
      from(tables.deviceCodes)
        .where((q) => q("expires_at").lessThan(new Date().toISOString()))
        .del(),
    );
  } catch (err) {
    console.error("[oauth] device-code sweep failed:", err);
  }
};

export const sweepExpiredRefreshTokens = async (cfg: OAuthConfig): Promise<void> => {
  const tables = resolveTables(cfg);
  try {
    await cfg.db.execute(
      from(tables.refreshTokens)
        .where((q) => q("expires_at").lessThan(new Date().toISOString()))
        .del(),
    );
  } catch (err) {
    console.error("[oauth] refresh-token sweep failed:", err);
  }
};

/** Convenience wrapper that runs all three sweeps concurrently. */
export const sweepExpired = async (cfg: OAuthConfig): Promise<void> => {
  await Promise.all([sweepExpiredAuthCodes(cfg), sweepExpiredDeviceCodes(cfg), sweepExpiredRefreshTokens(cfg)]);
};
