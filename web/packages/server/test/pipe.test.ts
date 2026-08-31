import { expect, test } from "bun:test";
import { assign, createConn, halt } from "../conn/index.ts";
import { pipe, pipeline } from "../pipe/index.ts";

test("pipe wraps a function", () => {
  const logger = pipe((c) => {
    return assign(c, { logged: true });
  });
  const conn = createConn(new Request("http://localhost/"));
  const result = logger(conn) as any;
  expect(result.assigns.logged).toBe(true);
});

test("pipeline composes pipes in order", async () => {
  const addA = pipe((c) => assign(c, { ...c.assigns, trace: `${(c.assigns.trace as string) ?? ""}A` }));
  const addB = pipe((c) => assign(c, { ...c.assigns, trace: `${(c.assigns.trace as string) ?? ""}B` }));
  const handler = pipe((c) => assign(c, { ...c.assigns, trace: `${(c.assigns.trace as string) ?? ""}H` }));

  const app = pipeline(addA, addB)(handler);
  const conn = createConn(new Request("http://localhost/"));
  const result = await app(conn);
  expect(result.assigns.trace).toBe("ABH");
});

test("pipeline stops on halt", async () => {
  const blocker = pipe((c) => halt(c, 403));
  const neverReached = pipe((c) => assign(c, { reached: true }));
  const handler = pipe((c) => assign(c, { handled: true }));

  const app = pipeline(blocker, neverReached)(handler);
  const conn = createConn(new Request("http://localhost/"));
  const result = await app(conn);
  expect(result.halted).toBe(true);
  expect(result.status).toBe(403);
  expect(result.assigns.reached).toBeUndefined();
  expect(result.assigns.handled).toBeUndefined();
});
