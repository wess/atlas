export type SessionStore = {
  readonly create: (data: Record<string, unknown>) => Promise<string>;
  readonly get: (id: string) => Promise<Record<string, unknown> | null>;
  readonly destroy: (id: string) => Promise<void>;
};

/**
 * In-memory session store. Pass `ttl` (seconds) to expire sessions; without it
 * sessions live until `destroy`, which is only safe for short-lived dev
 * processes. Expired entries are dropped lazily on `get` plus an opportunistic
 * sweep, so no timer keeps the process alive.
 */
export const createMemoryStore = (opts?: { ttl?: number }): SessionStore => {
  const ttlMs = opts?.ttl != null ? opts.ttl * 1000 : null;
  const sessions = new Map<string, { data: Record<string, unknown>; expiresAt: number | null }>();
  let opsSinceSweep = 0;

  const sweep = (now: number): void => {
    for (const [id, s] of sessions) {
      if (s.expiresAt !== null && now > s.expiresAt) sessions.delete(id);
    }
  };

  return {
    create: async (data) => {
      const id = crypto.randomUUID();
      const now = Date.now();
      opsSinceSweep += 1;
      if (opsSinceSweep >= 4096) {
        opsSinceSweep = 0;
        sweep(now);
      }
      sessions.set(id, { data, expiresAt: ttlMs !== null ? now + ttlMs : null });
      return id;
    },
    get: async (id) => {
      const s = sessions.get(id);
      if (!s) return null;
      if (s.expiresAt !== null && Date.now() > s.expiresAt) {
        sessions.delete(id);
        return null;
      }
      return s.data;
    },
    destroy: async (id) => {
      sessions.delete(id);
    },
  };
};
