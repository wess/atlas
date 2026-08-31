const HTTP_ERROR = Symbol.for("@atlas/server/HttpError");

export type HttpError = {
  readonly [HTTP_ERROR]: true;
  readonly name: "HttpError";
  readonly status: number;
  readonly message: string;
  readonly code?: string;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;
};

export type HttpErrorOptions = {
  readonly code?: string;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;
};

export const httpError = (status: number, message: string, opts: HttpErrorOptions = {}): HttpError => ({
  [HTTP_ERROR]: true,
  name: "HttpError",
  status,
  message,
  code: opts.code,
  details: opts.details,
  headers: opts.headers,
});

export const isHttpError = (value: unknown): value is HttpError =>
  typeof value === "object" && value !== null && (value as { [k: symbol]: unknown })[HTTP_ERROR] === true;

export const badRequest = (message = "Bad Request", opts?: HttpErrorOptions): HttpError =>
  httpError(400, message, opts);
export const unauthorized = (message = "Unauthorized", opts?: HttpErrorOptions): HttpError =>
  httpError(401, message, opts);
export const forbidden = (message = "Forbidden", opts?: HttpErrorOptions): HttpError => httpError(403, message, opts);
export const notFound = (message = "Not Found", opts?: HttpErrorOptions): HttpError => httpError(404, message, opts);
export const methodNotAllowed = (message = "Method Not Allowed", opts?: HttpErrorOptions): HttpError =>
  httpError(405, message, opts);
export const conflict = (message = "Conflict", opts?: HttpErrorOptions): HttpError => httpError(409, message, opts);
export const gone = (message = "Gone", opts?: HttpErrorOptions): HttpError => httpError(410, message, opts);
export const unprocessable = (message = "Unprocessable Content", opts?: HttpErrorOptions): HttpError =>
  httpError(422, message, opts);
export const tooManyRequests = (message = "Too Many Requests", opts?: HttpErrorOptions): HttpError =>
  httpError(429, message, opts);
export const internal = (message = "Internal Server Error", opts?: HttpErrorOptions): HttpError =>
  httpError(500, message, opts);
export const serviceUnavailable = (message = "Service Unavailable", opts?: HttpErrorOptions): HttpError =>
  httpError(503, message, opts);
