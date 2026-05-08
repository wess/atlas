import { expect, test } from "bun:test";
import {
  badRequest,
  conflict,
  forbidden,
  haltWith,
  httpError,
  isHttpError,
  notFound,
  unauthorized,
  unprocessable,
} from "../errors/index.ts";
import { pipe } from "../pipe/index.ts";
import { get, router } from "../router/index.ts";

test("httpError builds tagged error object", () => {
  const err = httpError(418, "I'm a teapot", { code: "TEAPOT", details: { brewing: true } });
  expect(err.status).toBe(418);
  expect(err.message).toBe("I'm a teapot");
  expect(err.code).toBe("TEAPOT");
  expect(err.details).toEqual({ brewing: true });
});

test("isHttpError discriminates from generic errors", () => {
  expect(isHttpError(notFound())).toBe(true);
  expect(isHttpError(new Error("nope"))).toBe(false);
  expect(isHttpError({ status: 404, message: "Not Found" })).toBe(false);
  expect(isHttpError(null)).toBe(false);
});

test("status helpers default messages", () => {
  expect(badRequest().status).toBe(400);
  expect(unauthorized().status).toBe(401);
  expect(forbidden().status).toBe(403);
  expect(notFound().status).toBe(404);
  expect(conflict().status).toBe(409);
  expect(unprocessable().status).toBe(422);
  expect(notFound().message).toBe("Not Found");
  expect(notFound("custom").message).toBe("custom");
});

test("router catches thrown HttpError and returns proper response", async () => {
  const app = router(
    get(
      "/missing",
      pipe(() => {
        throw notFound("user");
      }),
    ),
    get(
      "/conflict",
      pipe(() => {
        throw conflict("already exists", { code: "DUP", details: { field: "email" } });
      }),
    ),
  );

  const r1 = await app(new Request("http://localhost/missing"));
  expect(r1.status).toBe(404);
  expect(await r1.json()).toEqual({ error: "user" });

  const r2 = await app(new Request("http://localhost/conflict"));
  expect(r2.status).toBe(409);
  expect(await r2.json()).toEqual({
    error: "already exists",
    code: "DUP",
    details: { field: "email" },
  });
});

test("router preserves HttpError-supplied headers", async () => {
  const app = router(
    get(
      "/limited",
      pipe(() => {
        throw httpError(429, "slow down", { headers: { "Retry-After": "60" } });
      }),
    ),
  );
  const res = await app(new Request("http://localhost/limited"));
  expect(res.status).toBe(429);
  expect(res.headers.get("Retry-After")).toBe("60");
});

test("haltWith short-circuits the conn with HttpError data", async () => {
  const app = router(
    get(
      "/h",
      pipe((c) => haltWith(c, unauthorized("nope", { code: "BAD_TOKEN" }))),
    ),
  );
  const res = await app(new Request("http://localhost/h"));
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: "nope", code: "BAD_TOKEN" });
});
