export type Conn = {
  readonly method: string;
  readonly path: string;
  readonly params: Record<string, string>;
  readonly headers: Headers;
  readonly query: Record<string, string>;
  readonly body: unknown;
  readonly assigns: Record<string, unknown>;
  readonly status: number;
  readonly respHeaders: Headers;
  readonly halted: boolean;
  readonly request: Request;
};

export const createConn = (req: Request, params?: Record<string, string>): Conn => {
  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    query[k] = v;
  });
  return {
    method: req.method,
    path: url.pathname,
    params: params ?? {},
    headers: req.headers,
    query,
    body: req,
    assigns: {},
    status: 200,
    respHeaders: new Headers(),
    halted: false,
    request: req,
  };
};

export const assign = (conn: Conn, data: Record<string, unknown>): Conn => ({
  ...conn,
  assigns: { ...conn.assigns, ...data },
});

export const putHeader = (conn: Conn, key: string, value: string): Conn => {
  const headers = new Headers(conn.respHeaders);
  headers.set(key, value);
  return { ...conn, respHeaders: headers };
};

export const halt = (conn: Conn, status: number, body?: unknown): Conn => ({
  ...conn,
  halted: true,
  status,
  body: body ?? conn.body,
});

export const setStatus = (conn: Conn, status: number): Conn => ({ ...conn, status });
