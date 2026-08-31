import type { ChallengeHook } from "../acme/client.ts";

const PREFIX = "/.well-known/acme-challenge/";

export type ChallengeStore = ChallengeHook & {
  readonly answer: (pathname: string) => string | null;
  readonly active: () => number;
};

export const createChallengeStore = (): ChallengeStore => {
  const tokens = new Map<string, string>();
  return {
    set: (token, keyAuth) => {
      tokens.set(token, keyAuth);
    },
    clear: (token) => {
      tokens.delete(token);
    },
    answer: (pathname) => {
      if (!pathname.startsWith(PREFIX)) return null;
      return tokens.get(pathname.slice(PREFIX.length)) ?? null;
    },
    active: () => tokens.size,
  };
};
