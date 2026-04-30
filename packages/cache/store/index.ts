export type Cache = {
  readonly get: <T = unknown>(key: string) => Promise<T | null>;
  readonly set: (key: string, value: unknown, opts?: { ttl?: number }) => Promise<void>;
  readonly del: (key: string) => Promise<void>;
  readonly expire: (key: string, seconds: number) => Promise<void>;
  readonly flush: () => Promise<void>;
  readonly close: () => Promise<void>;
};

// Cap the in-memory cache so a long-running process can't OOM. Map iteration
// order is insertion order, so the first key is the oldest insert — close
// enough to LRU for a dev/test cache. Override via `maxEntries` if you need
// something larger.
const DEFAULT_MAX_ENTRIES = 10_000;

export const createMemoryCache = (opts?: { maxEntries?: number }): Cache => {
  const max = opts?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const store = new Map<string, { value: string; expiresAt?: number }>();

  const evictIfNeeded = () => {
    while (store.size > max) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) return;
      store.delete(oldest);
    }
  };

  return {
    get: async <T = unknown>(key: string): Promise<T | null> => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return JSON.parse(entry.value) as T;
    },
    set: async (key, value, setOpts?) => {
      const entry: { value: string; expiresAt?: number } = { value: JSON.stringify(value) };
      if (setOpts?.ttl != null) entry.expiresAt = Date.now() + setOpts.ttl * 1000;
      // Refresh insertion order so frequently-set keys move to the back.
      store.delete(key);
      store.set(key, entry);
      evictIfNeeded();
    },
    del: async (key) => {
      store.delete(key);
    },
    expire: async (key, seconds) => {
      const entry = store.get(key);
      if (entry) entry.expiresAt = Date.now() + seconds * 1000;
    },
    flush: async () => {
      store.clear();
    },
    close: async () => {
      store.clear();
    },
  };
};

export const createCache = (opts: { url: string }): Cache => {
  const redis = new (Bun as any).RedisClient(opts.url);

  return {
    get: async <T = unknown>(key: string): Promise<T | null> => {
      const raw = await redis.get(key);
      if (raw === null || raw === undefined) return null;
      return JSON.parse(raw) as T;
    },
    set: async (key, value, setOpts?) => {
      const serialized = JSON.stringify(value);
      if (setOpts?.ttl) {
        await redis.set(key, serialized, { EX: setOpts.ttl });
      } else {
        await redis.set(key, serialized);
      }
    },
    del: async (key) => {
      await redis.del(key);
    },
    expire: async (key, seconds) => {
      await redis.expire(key, seconds);
    },
    flush: async () => {
      await redis.flushdb();
    },
    close: async () => {
      await redis.close();
    },
  };
};
