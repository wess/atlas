export type Cache = {
  readonly get: <T = unknown>(key: string) => Promise<T | null>;
  readonly set: (key: string, value: unknown, opts?: { ttl?: number }) => Promise<void>;
  readonly del: (key: string) => Promise<void>;
  readonly expire: (key: string, seconds: number) => Promise<void>;
  readonly flush: () => Promise<void>;
  readonly close: () => Promise<void>;
};

export const createMemoryCache = (): Cache => {
  const store = new Map<string, { value: string; expiresAt?: number }>();

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
    set: async (key, value, opts?) => {
      const entry: { value: string; expiresAt?: number } = { value: JSON.stringify(value) };
      if (opts?.ttl != null) entry.expiresAt = Date.now() + opts.ttl * 1000;
      store.set(key, entry);
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
