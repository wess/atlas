import type { Conn } from "../conn/index.ts";
import { unprocessable } from "../errors/http.ts";
import type { PipeFn } from "../pipe/index.ts";
import { pipeline } from "../pipe/index.ts";
import type { Route } from "../router/index.ts";

// A validator is anything that can transform unknown input into T.
// Zod schemas, plain functions, and anything Standard-Schema-shaped all qualify.
export type Validator<T> = ((input: unknown) => T) | { readonly parse: (input: unknown) => T };

const runValidator = <T>(v: Validator<T>, input: unknown): T => {
  if (typeof v === "function") return v(input);
  return v.parse(input);
};

const tryValidate = <T>(v: Validator<T>, input: unknown, where: string): T => {
  try {
    return runValidator(v, input);
  } catch (err) {
    const issues = (err as { issues?: unknown }).issues;
    throw unprocessable(`Invalid ${where}`, {
      code: "VALIDATION_FAILED",
      details: { where, issues: issues ?? (err as Error).message },
    });
  }
};

// TypedConn narrows params/body/query/assigns based on the route schemas.
export type TypedConn<P, B, Q, A> = Omit<Conn, "params" | "body" | "query" | "assigns"> & {
  readonly params: P;
  readonly body: B;
  readonly query: Q;
  readonly assigns: A;
};

export type RouteSchemas<P, B, Q, A> = {
  readonly params?: Validator<P>;
  readonly body?: Validator<B>;
  readonly query?: Validator<Q>;
  // Pipes that run before validation (e.g., requireAuth, parseMultipart).
  readonly before?: readonly PipeFn[];
  // Type-only marker for what conn.assigns will look like at handler time.
  // Populated by `before` pipes — kept as a phantom field so callers write
  // `assigns: {} as { auth: AuthClaims }` and the handler picks up the type.
  readonly assigns?: A;
};

export type RouteHandler<P, B, Q, A> = (conn: TypedConn<P, B, Q, A>) => Conn | Promise<Conn>;

const readJson = async (req: Request): Promise<unknown> => {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw unprocessable("Expected application/json body", { code: "INVALID_CONTENT_TYPE" });
  }
  try {
    return await req.json();
  } catch {
    throw unprocessable("Body is not valid JSON", { code: "INVALID_JSON" });
  }
};

const buildValidationPipe = <P, B, Q, A>(schemas: RouteSchemas<P, B, Q, A>): PipeFn => {
  return async (conn) => {
    let next: Conn = conn;

    if (schemas.params) {
      const params = tryValidate(schemas.params, conn.params, "params");
      next = { ...next, params: params as unknown as Record<string, string> };
    }

    if (schemas.query) {
      const query = tryValidate(schemas.query, conn.query, "query");
      next = { ...next, query: query as unknown as Record<string, string> };
    }

    if (schemas.body) {
      // If body wasn't already parsed by an upstream pipe, parse JSON here.
      let raw: unknown = next.body;
      if (raw instanceof Request) raw = await readJson(conn.request);
      const body = tryValidate(schemas.body, raw, "body");
      next = { ...next, body };
    }

    return next;
  };
};

// Build a Route from a method + path + validation schemas + a typed handler.
// Body, params, query are validated *after* `before` pipes run — so guards like
// requireAuth can populate conn.assigns.auth before validation sees the request.
export const route = <
  P = Record<string, string>,
  B = unknown,
  Q = Record<string, string>,
  A = Record<string, unknown>,
>(
  method: string,
  path: string,
  schemas: RouteSchemas<P, B, Q, A>,
  handler: RouteHandler<P, B, Q, A>,
): Route => {
  const before = schemas.before ?? [];
  const validate = buildValidationPipe(schemas);
  const composed = pipeline(...before, validate)(handler as PipeFn);
  return { method: method.toUpperCase(), pattern: path, handler: composed };
};

export const getR = <P = Record<string, string>, B = unknown, Q = Record<string, string>, A = Record<string, unknown>>(
  path: string,
  schemas: RouteSchemas<P, B, Q, A>,
  handler: RouteHandler<P, B, Q, A>,
): Route => route("GET", path, schemas, handler);

export const postR = <P = Record<string, string>, B = unknown, Q = Record<string, string>, A = Record<string, unknown>>(
  path: string,
  schemas: RouteSchemas<P, B, Q, A>,
  handler: RouteHandler<P, B, Q, A>,
): Route => route("POST", path, schemas, handler);

export const putR = <P = Record<string, string>, B = unknown, Q = Record<string, string>, A = Record<string, unknown>>(
  path: string,
  schemas: RouteSchemas<P, B, Q, A>,
  handler: RouteHandler<P, B, Q, A>,
): Route => route("PUT", path, schemas, handler);

export const patchR = <
  P = Record<string, string>,
  B = unknown,
  Q = Record<string, string>,
  A = Record<string, unknown>,
>(
  path: string,
  schemas: RouteSchemas<P, B, Q, A>,
  handler: RouteHandler<P, B, Q, A>,
): Route => route("PATCH", path, schemas, handler);

export const delR = <P = Record<string, string>, B = unknown, Q = Record<string, string>, A = Record<string, unknown>>(
  path: string,
  schemas: RouteSchemas<P, B, Q, A>,
  handler: RouteHandler<P, B, Q, A>,
): Route => route("DELETE", path, schemas, handler);
