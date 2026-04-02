import type { Interceptors } from "../interceptors/index.ts";
import { applyRequestInterceptors, applyResponseInterceptors } from "../interceptors/index.ts";
import type { RetryOptions } from "../retry/index.ts";
import { withRetry } from "../retry/index.ts";

export type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  json?: unknown;
  body?: BodyInit;
  retry?: RetryOptions;
};

export type ClientOptions = {
  baseUrl: string;
  headers?: Record<string, string>;
  retry?: RetryOptions;
  interceptors?: Interceptors;
};

export type Client = {
  readonly get: (path: string, opts?: RequestOptions) => Promise<Response>;
  readonly post: (path: string, opts?: RequestOptions) => Promise<Response>;
  readonly put: (path: string, opts?: RequestOptions) => Promise<Response>;
  readonly patch: (path: string, opts?: RequestOptions) => Promise<Response>;
  readonly del: (path: string, opts?: RequestOptions) => Promise<Response>;
  readonly request: (path: string, opts?: RequestOptions) => Promise<Response>;
};

export const request = async (url: string, opts?: RequestOptions): Promise<Response> => {
  const headers: Record<string, string> = { ...opts?.headers };
  let body: BodyInit | undefined = opts?.body;

  if (opts?.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.json);
  }

  const init: RequestInit = {
    method: opts?.method ?? "GET",
    headers,
    body,
  };

  const doFetch = () => fetch(url, init);

  if (opts?.retry) {
    return withRetry(doFetch, opts.retry);
  }

  return doFetch();
};

export const createClient = (config: ClientOptions): Client => {
  const send = async (path: string, opts?: RequestOptions): Promise<Response> => {
    const url = `${config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      ...config.headers,
      ...opts?.headers,
    };
    let body: BodyInit | undefined = opts?.body;

    if (opts?.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.json);
    }

    let init: RequestInit = {
      method: opts?.method ?? "GET",
      headers,
      body,
    };

    let finalUrl = url;
    if (config.interceptors?.request) {
      const intercepted = await applyRequestInterceptors(finalUrl, init, config.interceptors.request);
      finalUrl = intercepted.url;
      init = intercepted.init;
    }

    const retryOpts = opts?.retry ?? config.retry;

    const doFetch = async () => {
      const res = await fetch(finalUrl, init);
      if (config.interceptors?.response) {
        return applyResponseInterceptors(res, config.interceptors.response);
      }
      return res;
    };

    if (retryOpts) {
      return withRetry(doFetch, retryOpts);
    }

    return doFetch();
  };

  return {
    get: (path, opts?) => send(path, { ...opts, method: "GET" }),
    post: (path, opts?) => send(path, { ...opts, method: "POST" }),
    put: (path, opts?) => send(path, { ...opts, method: "PUT" }),
    patch: (path, opts?) => send(path, { ...opts, method: "PATCH" }),
    del: (path, opts?) => send(path, { ...opts, method: "DELETE" }),
    request: send,
  };
};
