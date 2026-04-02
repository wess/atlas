import type { Conn } from "../conn/index.ts";
import type { PipeFn } from "../pipe/index.ts";

export const onError = (handler: (conn: Conn, error: Error) => Conn | Promise<Conn>): PipeFn => {
  const fn: PipeFn = (conn) => conn;
  (fn as any).__errorHandler = handler;
  return fn;
};
