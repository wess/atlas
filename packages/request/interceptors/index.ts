export type RequestInterceptor = (
  url: string,
  init: RequestInit,
) => { url: string; init: RequestInit } | Promise<{ url: string; init: RequestInit }>;

export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

export type Interceptors = {
  request?: RequestInterceptor[];
  response?: ResponseInterceptor[];
};

export const applyRequestInterceptors = async (
  url: string,
  init: RequestInit,
  interceptors?: RequestInterceptor[],
): Promise<{ url: string; init: RequestInit }> => {
  let current = { url, init };
  if (interceptors) {
    for (const fn of interceptors) {
      current = await fn(current.url, current.init);
    }
  }
  return current;
};

export const applyResponseInterceptors = async (
  response: Response,
  interceptors?: ResponseInterceptor[],
): Promise<Response> => {
  let current = response;
  if (interceptors) {
    for (const fn of interceptors) {
      current = await fn(current);
    }
  }
  return current;
};
