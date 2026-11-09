export type ParamCounter = {
  readonly next: () => string;
  readonly current: () => number;
};

export const createParamCounter = (start: number = 1): ParamCounter => {
  let count = start;
  return {
    next: () => `$${count++}`,
    current: () => count - 1,
  };
};

const PLACEHOLDER = /\$(\d+)/g;

/**
 * Splice a raw() fragment into a larger query. Each `$n` in the fragment refers
 * to the fragment's n-th value, so "a = $1 OR b = $1" binds the same value
 * twice. Every occurrence gets a fresh placeholder from the counter with its
 * value pushed alongside, which keeps positional dialects (sqlite `?`) correct.
 */
export const bindFragment = (
  fragment: { readonly sql: string; readonly values: readonly unknown[] },
  counter: ParamCounter,
  values: unknown[],
): string => {
  const highest = [...fragment.sql.matchAll(PLACEHOLDER)].reduce((max, m) => Math.max(max, Number(m[1])), 0);
  if (highest !== fragment.values.length) {
    throw new Error(
      `raw() placeholder mismatch in "${fragment.sql}": highest placeholder is $${highest} but ${fragment.values.length} value(s) were given.`,
    );
  }
  return fragment.sql.replaceAll(PLACEHOLDER, (_match, n: string) => {
    const index = Number(n);
    if (index < 1)
      throw new Error(`raw() placeholder $${n} in "${fragment.sql}" is invalid; placeholders start at $1.`);
    values.push(fragment.values[index - 1]);
    return counter.next();
  });
};
