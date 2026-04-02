export type SessionStore = {
  readonly create: (data: Record<string, unknown>) => Promise<string>;
  readonly get: (id: string) => Promise<Record<string, unknown> | null>;
  readonly destroy: (id: string) => Promise<void>;
};

export const createMemoryStore = (): SessionStore => {
  const sessions = new Map<string, Record<string, unknown>>();
  return {
    create: async (data) => {
      const id = crypto.randomUUID();
      sessions.set(id, data);
      return id;
    },
    get: async (id) => sessions.get(id) ?? null,
    destroy: async (id) => {
      sessions.delete(id);
    },
  };
};
