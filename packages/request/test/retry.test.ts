import { expect, test } from "bun:test";
import { withRetry } from "../retry/index.ts";

test("withRetry returns success immediately", async () => {
  let calls = 0;
  const res = await withRetry(
    () => {
      calls++;
      return Promise.resolve(new Response("ok", { status: 200 }));
    },
    { attempts: 3, delay: 1 },
  );
  expect(calls).toBe(1);
  expect(res.status).toBe(200);
});

test("withRetry retries on 500", async () => {
  let calls = 0;
  const res = await withRetry(
    () => {
      calls++;
      if (calls < 3) return Promise.resolve(new Response("fail", { status: 500 }));
      return Promise.resolve(new Response("ok", { status: 200 }));
    },
    { attempts: 3, delay: 1 },
  );
  expect(calls).toBe(3);
  expect(res.status).toBe(200);
});

test("withRetry gives up after max attempts", async () => {
  let calls = 0;
  const res = await withRetry(
    () => {
      calls++;
      return Promise.resolve(new Response("fail", { status: 500 }));
    },
    { attempts: 2, delay: 1 },
  );
  expect(calls).toBe(2);
  expect(res.status).toBe(500);
});
