import type { Cache } from "../store/index.ts";

const buildKey = (prefix: string, args: readonly unknown[]): string =>
  `${encodeURIComponent(prefix)}:${args
    .map((value) =>
      encodeURIComponent(
        `${typeof value}:${value && typeof value === "object" ? JSON.stringify(value) : String(value)}`,
      ),
    )
    .join(":")}`;

export const cached = <T, A extends unknown[]>(
  cache: Cache,
  prefix: string,
  fn: (...args: A) => Promise<T>,
  opts?: { ttl?: number },
) => {
  const pending = new Map<string, Promise<T>>();
  return async (...args: A): Promise<T> => {
    const key = buildKey(prefix, args);
    const existing = await cache.get<T>(key);
    if (existing !== null) return existing;
    const inflight = pending.get(key);
    if (inflight) return inflight;
    const load = async (): Promise<T> => {
      const result = await fn(...args);
      await cache.set(key, result, opts);
      return result;
    };
    const result = load();
    pending.set(key, result);
    try {
      return await result;
    } finally {
      pending.delete(key);
    }
  };
};

export const invalidate = async (cache: Cache, prefix: string, ...args: unknown[]): Promise<void> => {
  await cache.del(buildKey(prefix, args));
};
