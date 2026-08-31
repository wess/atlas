import { expect, test } from "bun:test";
import { assign } from "../conn/index.ts";
import { pipe, pipeline } from "../pipe/index.ts";
import { json } from "../response/index.ts";
import { get, post, router } from "../router/index.ts";

test("router matches GET routes", async () => {
  const app = router(
    get(
      "/",
      pipe((c) => json(c, 200, { hello: "world" })),
    ),
    get(
      "/users/:id",
      pipe((c) => json(c, 200, { id: c.params.id })),
    ),
  );

  const res = await app(new Request("http://localhost/"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toEqual({ hello: "world" });
});

test("router extracts params", async () => {
  const app = router(
    get(
      "/users/:id",
      pipe((c) => json(c, 200, { id: c.params.id })),
    ),
  );

  const res = await app(new Request("http://localhost/users/42"));
  const body = await res.json();
  expect(body).toEqual({ id: "42" });
});

test("router returns 404 for unmatched", async () => {
  const app = router(
    get(
      "/",
      pipe((c) => json(c, 200, { ok: true })),
    ),
  );

  const res = await app(new Request("http://localhost/nope"));
  expect(res.status).toBe(404);
});

test("router works with pipeline", async () => {
  const addUser = pipe((c) => assign(c, { user: "wess" }));
  const authed = pipeline(addUser);

  const app = router(get("/me", authed(pipe((c) => json(c, 200, { user: c.assigns.user })))));

  const res = await app(new Request("http://localhost/me"));
  const body = await res.json();
  expect(body).toEqual({ user: "wess" });
});

test("router matches POST routes", async () => {
  const app = router(
    post(
      "/users",
      pipe((c) => json(c, 201, { created: true })),
    ),
  );

  const res = await app(new Request("http://localhost/users", { method: "POST" }));
  expect(res.status).toBe(201);
});
