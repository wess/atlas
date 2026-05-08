import { expect, test } from "bun:test";
import { assign } from "../conn/index.ts";
import { pipe } from "../pipe/index.ts";
import { json } from "../response/index.ts";
import { delR, getR, postR } from "../route/index.ts";
import { router } from "../router/index.ts";

// Tiny zod-like validators: anything with `.parse(unknown) -> T` works.
const asObject = <T extends Record<string, (v: unknown) => unknown>>(shape: T) => ({
  parse: (input: unknown) => {
    if (input === null || typeof input !== "object") throw new Error("expected object");
    const out: Record<string, unknown> = {};
    for (const [key, fn] of Object.entries(shape)) {
      try {
        out[key] = fn((input as Record<string, unknown>)[key]);
      } catch (err) {
        throw new Error(`${key}: ${(err as Error).message}`);
      }
    }
    return out as { [K in keyof T]: ReturnType<T[K]> };
  },
});

const asNumber = (v: unknown) => {
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error("not a number");
  return n;
};
const asString = (v: unknown) => {
  if (typeof v !== "string") throw new Error("not a string");
  return v;
};
const asNonEmptyString = (v: unknown) => {
  const s = asString(v);
  if (s.length === 0) throw new Error("empty string");
  return s;
};
const asEmail = (v: unknown) => {
  const s = asString(v);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error("not an email");
  return s;
};
const asNumberWithDefault = (d: number) => (v: unknown) => (v === undefined || v === "" ? d : asNumber(v));

test("route() validates params and narrows types", async () => {
  const r = router(
    getR(
      "/users/:id",
      { params: asObject({ id: asNumber }) },
      (c) => json(c, 200, { idType: typeof c.params.id, id: c.params.id }),
    ),
  );

  const ok = await r(new Request("http://localhost/users/42"));
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual({ idType: "number", id: 42 });

  const bad = await r(new Request("http://localhost/users/abc"));
  expect(bad.status).toBe(422);
  const body = await bad.json();
  expect(body.error).toBe("Invalid params");
  expect(body.code).toBe("VALIDATION_FAILED");
});

test("route() parses + validates JSON body", async () => {
  const r = router(
    postR(
      "/users",
      { body: asObject({ email: asEmail, name: asNonEmptyString }) },
      (c) => json(c, 201, c.body),
    ),
  );

  const ok = await r(
    new Request("http://localhost/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.c", name: "Ada" }),
    }),
  );
  expect(ok.status).toBe(201);
  expect(await ok.json()).toEqual({ email: "a@b.c", name: "Ada" });

  const bad = await r(
    new Request("http://localhost/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", name: "" }),
    }),
  );
  expect(bad.status).toBe(422);
});

test("route() rejects non-JSON body when body schema is set", async () => {
  const r = router(
    postR(
      "/x",
      { body: asObject({ a: asString }) },
      (c) => json(c, 200, c.body),
    ),
  );
  const res = await r(
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hi",
    }),
  );
  expect(res.status).toBe(422);
  expect((await res.json()).code).toBe("INVALID_CONTENT_TYPE");
});

test("route() runs `before` pipes ahead of validation, populates assigns", async () => {
  const setUser = pipe((c) => assign(c, { auth: { id: 7 } }));

  type Auth = { auth: { id: number } };

  const r = router(
    getR<{ id: number }, never, Record<string, string>, Auth>(
      "/me/:id",
      {
        params: asObject({ id: asNumber }),
        before: [setUser],
        assigns: {} as Auth,
      },
      (c) => json(c, 200, { authId: c.assigns.auth.id, paramId: c.params.id }),
    ),
  );

  const res = await r(new Request("http://localhost/me/3"));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ authId: 7, paramId: 3 });
});

test("route() validates query string", async () => {
  const r = router(
    getR(
      "/search",
      {
        query: asObject({ q: asNonEmptyString, limit: asNumberWithDefault(10) }),
      },
      (c) => json(c, 200, c.query),
    ),
  );
  const res = await r(new Request("http://localhost/search?q=hello&limit=5"));
  expect(await res.json()).toEqual({ q: "hello", limit: 5 });

  const bad = await r(new Request("http://localhost/search?q="));
  expect(bad.status).toBe(422);
});

test("route() accepts plain-function validators", async () => {
  const toNum = (input: unknown) => {
    const v = (input as { id?: string })?.id;
    const n = Number(v);
    if (Number.isNaN(n)) throw new Error("not a number");
    return { id: n };
  };

  const r = router(getR("/x/:id", { params: toNum }, (c) => json(c, 200, { id: c.params.id })));
  const ok = await r(new Request("http://localhost/x/9"));
  expect(await ok.json()).toEqual({ id: 9 });
});

test("route() works without schemas (passthrough)", async () => {
  const r = router(delR("/items/:id", {}, (c) => json(c, 204, { ok: true })));
  const res = await r(new Request("http://localhost/items/123", { method: "DELETE" }));
  expect(res.status).toBe(204);
});

test("route() halt in `before` short-circuits BEFORE validation runs", async () => {
  // If a guard pipe halts (e.g., 401), validation must not see the request —
  // otherwise a missing-auth request with malformed body would render 422
  // instead of 401, leaking info about which fields the API expects.
  const denyAll = pipe((c) => ({ ...c, halted: true, status: 401, body: { error: "denied" } }));

  const r = router(
    postR(
      "/protected",
      {
        body: asObject({ secret: asString }),
        before: [denyAll],
      },
      (c) => json(c, 200, c.body),
    ),
  );

  const res = await r(
    new Request("http://localhost/protected", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ definitelyNot: "secret" }),
    }),
  );
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: "denied" });
});

test("route() composes with @atlas/auth-style guards: typed claims, typed body, typed params", async () => {
  // Simulate requireAuth — read header, populate conn.assigns.auth, otherwise halt.
  const fakeAuth = pipe((c) => {
    const token = c.headers.get("authorization");
    if (token !== "Bearer ok") return { ...c, halted: true, status: 401, body: { error: "unauthorized" } };
    return { ...c, assigns: { ...c.assigns, auth: { id: 42 } } };
  });

  type Auth = { auth: { id: number } };

  const r = router(
    postR<{ groupId: number }, { content: string }, Record<string, string>, Auth>(
      "/groups/:groupId/posts",
      {
        params: asObject({ groupId: asNumber }),
        body: asObject({ content: asNonEmptyString }),
        before: [fakeAuth],
        assigns: {} as Auth,
      },
      (c) =>
        json(c, 201, {
          authorId: c.assigns.auth.id,
          groupId: c.params.groupId,
          content: c.body.content,
        }),
    ),
  );

  // Happy path
  const ok = await r(
    new Request("http://localhost/groups/3/posts", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ok" },
      body: JSON.stringify({ content: "hello" }),
    }),
  );
  expect(ok.status).toBe(201);
  expect(await ok.json()).toEqual({ authorId: 42, groupId: 3, content: "hello" });

  // No auth → 401, body never validated.
  const noAuth = await r(
    new Request("http://localhost/groups/3/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "hello" }),
    }),
  );
  expect(noAuth.status).toBe(401);

  // Auth ok, body invalid → 422.
  const badBody = await r(
    new Request("http://localhost/groups/3/posts", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ok" },
      body: JSON.stringify({ content: "" }),
    }),
  );
  expect(badBody.status).toBe(422);
});
