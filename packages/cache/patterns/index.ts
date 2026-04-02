import type { Cache } from "../store/index.ts";

export const cached = <T, A extends unknown[]>(
  cache: Cache,
  prefix: string,
  fn: (...args: A) => Promise<T>,
  opts?: { ttl?: number },
) => {
  return async (...args: A): Promise<T> => {
    const key = `${prefix}:${args.map(String).join(":")}`;
    const existing = await cache.get<T>(key);
    if (existing !== null) return existing;
    const result = await fn(...args);
    await cache.set(key, result, opts);
    return result;
  };
};

export const invalidate = async (cache: Cache, prefix: string, ...args: unknown[]): Promise<void> => {
  const key = `${prefix}:${args.map(String).join(":")}`;
  await cache.del(key);
};
