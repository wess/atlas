import type { Conn } from "../conn/index.ts";
import { halt, putHeader } from "../conn/index.ts";
import type { PipeFn } from "../pipe/index.ts";
import { type HttpError, isHttpError } from "./http.ts";

export const onError = (handler: (conn: Conn, error: Error) => Conn | Promise<Conn>): PipeFn => {
  const fn: PipeFn = (conn) => conn;
  (fn as any).__errorHandler = handler;
  return fn;
};

export const haltWith = (conn: Conn, error: HttpError): Conn => {
  let next = conn;
  if (error.headers) {
    for (const [key, value] of Object.entries(error.headers)) {
      next = putHeader(next, key, value);
    }
  }
  const body: Record<string, unknown> = { error: error.message };
  if (error.code) body.code = error.code;
  if (error.details !== undefined) body.details = error.details;
  return halt(next, error.status, body);
};

export { isHttpError };
export type { HttpError };
export {
  badRequest,
  conflict,
  forbidden,
  gone,
  httpError,
  internal,
  methodNotAllowed,
  notFound,
  serviceUnavailable,
  tooManyRequests,
  unauthorized,
  unprocessable,
} from "./http.ts";
export type { HttpErrorOptions } from "./http.ts";
