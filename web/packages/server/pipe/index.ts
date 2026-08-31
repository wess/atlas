import type { Conn } from "../conn/index.ts";

export type PipeFn = (conn: Conn) => Conn | Promise<Conn>;

export const pipe = (fn: PipeFn): PipeFn => fn;

export const pipeline = (...pipes: PipeFn[]) => {
  return (handler: PipeFn): PipeFn => {
    return async (conn: Conn): Promise<Conn> => {
      let current = conn;
      for (const p of pipes) {
        if (current.halted) return current;
        current = await p(current);
      }
      if (current.halted) return current;
      return await handler(current);
    };
  };
};
