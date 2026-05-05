import type { CertRecord } from "./store.ts";

const RENEW_BEFORE_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_DELAY_MS = 60 * 1000;
const MAX_TIMER_MS = 0x7fffffff;

export type RenewalScheduler = {
  readonly schedule: (key: string, record: CertRecord) => void;
  readonly cancel: (key: string) => void;
  readonly stop: () => void;
};

export const renewAt = (record: CertRecord): number =>
  Math.max(record.notAfter - RENEW_BEFORE_MS, Date.now() + MIN_DELAY_MS);

export const createRenewalScheduler = (onRenew: (key: string) => Promise<void>): RenewalScheduler => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let stopped = false;

  const schedule = (key: string, record: CertRecord): void => {
    if (stopped) return;
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    const fireAt = renewAt(record);
    const delay = Math.min(Math.max(fireAt - Date.now(), MIN_DELAY_MS), MAX_TIMER_MS);
    const t = setTimeout(() => {
      timers.delete(key);
      onRenew(key).catch((err) => {
        console.error(`[atlas:edge] renewal failed for ${key}:`, err);
      });
    }, delay);
    timers.set(key, t);
  };

  return {
    schedule,
    cancel: (key) => {
      const t = timers.get(key);
      if (t) {
        clearTimeout(t);
        timers.delete(key);
      }
    },
    stop: () => {
      stopped = true;
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
  };
};
