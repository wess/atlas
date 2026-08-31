import type { Cache } from "../store/index.ts";

// Encode each key segment so a colon inside an argument can't collide with
// the segment separator — e.g. cached("user", "1:extra") and cached("user",
// "1", "extra") used to share a key.
const buildKey = (prefix: string, args: readonly unknown[]): string =>
  `${prefix}:${args.map((a) => encodeURIComponent(String(a))).join(":")}`;

export const cached = <T, A extends unknown[]>(
  cache: Cache,
  prefix: string,
  fn: (...args: A) => Promise<T>,
  opts?: { ttl?: number },
) => {
  return async (...args: A): Promise<T> => {
    const key = buildKey(prefix, args);
    const existing = await cache.get<T>(key);
    if (existing !== null) return existing;
    const result = await fn(...args);
    await cache.set(key, result, opts);
    return result;
  };
};

export const invalidate = async (cache: Cache, prefix: string, ...args: unknown[]): Promise<void> => {
  await cache.del(buildKey(prefix, args));
};
