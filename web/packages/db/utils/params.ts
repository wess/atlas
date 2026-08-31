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

export const renumberParams = (sql: string, counter: ParamCounter): string =>
  sql.replaceAll(/\$(\d+)/g, () => counter.next());
