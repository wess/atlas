import { expect, test } from "bun:test";
import { compose, createAdapter } from "../adapter/index.ts";

test("createAdapter creates an adapter", () => {
  const adapter = createAdapter("test", () => ({ stop: () => {} }));
  expect(adapter.name).toBe("test");
});

test("compose starts and stops multiple adapters", () => {
  let started = 0;
  let stopped = 0;
  const a1 = createAdapter("a1", () => {
    started++;
    return {
      stop: () => {
        stopped++;
      },
    };
  });
  const a2 = createAdapter("a2", () => {
    started++;
    return {
      stop: () => {
        stopped++;
      },
    };
  });

  const composed = compose([
    { adapter: a1, config: {} },
    { adapter: a2, config: {} },
  ]);
  expect(started).toBe(2);
  expect(Object.keys(composed.adapters)).toEqual(["a1", "a2"]);
  composed.stop();
  expect(stopped).toBe(2);
});
