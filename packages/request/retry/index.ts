export type RetryOptions = {
  attempts?: number;
  delay?: number;
  backoff?: number;
  retryOn?: (res: Response) => boolean;
};

export const withRetry = async (fn: () => Promise<Response>, opts?: RetryOptions): Promise<Response> => {
  const attempts = opts?.attempts ?? 3;
  const delay = opts?.delay ?? 1000;
  const backoff = opts?.backoff ?? 2;
  const shouldRetry = opts?.retryOn ?? ((res: Response) => res.status >= 500);

  let lastResponse: Response | undefined;
  for (let i = 0; i < attempts; i++) {
    const res = await fn();
    if (!shouldRetry(res) || i === attempts - 1) return res;
    lastResponse = res;
    await new Promise((r) => setTimeout(r, delay * backoff ** i));
  }
  return lastResponse!;
};
