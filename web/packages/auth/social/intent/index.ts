export type SocialIntentStore = {
  remember: (provider: string, nonce: string, returnTo: string, expires: number) => Promise<void>;
  take: (provider: string, nonce: string) => Promise<string | undefined>;
};

// redirect hints only; authentication still requires the separate signed browser cookie
export const createMemoryIntentStore = (options: { maxEntries?: number } = {}): SocialIntentStore => {
  const maxEntries = options.maxEntries ?? 512;
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("maxEntries must be a positive integer");
  const entries = new Map<string, { returnTo: string; expires: number }>();
  const key = (provider: string, nonce: string): string => JSON.stringify([provider, nonce]);
  return {
    remember: async (provider, nonce, returnTo, expires) => {
      if (returnTo.length > 4096 || expires <= Date.now()) return;
      if (entries.size >= maxEntries) {
        for (const [id, entry] of entries) if (entry.expires <= Date.now()) entries.delete(id);
        if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);
      }
      entries.set(key(provider, nonce), { returnTo, expires });
    },
    take: async (provider, nonce) => {
      const id = key(provider, nonce);
      const entry = entries.get(id);
      entries.delete(id);
      return entry && entry.expires > Date.now() ? entry.returnTo : undefined;
    },
  };
};
