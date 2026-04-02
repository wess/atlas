import { expect, test } from "bun:test";
import { assign, createConn, halt, putHeader } from "../conn/index.ts";

test("createConn parses request", () => {
  const req = new Request("http://localhost:3000/users?page=1", { method: "GET" });
  const conn = createConn(req);
  expect(conn.method).toBe("GET");
  expect(conn.path).toBe("/users");
  expect(conn.query.page).toBe("1");
  expect(conn.halted).toBe(false);
  expect(conn.status).toBe(200);
});

test("createConn accepts params", () => {
  const req = new Request("http://localhost:3000/users/42");
  const conn = createConn(req, { id: "42" });
  expect(conn.params.id).toBe("42");
});

test("assign adds to assigns immutably", () => {
  const req = new Request("http://localhost:3000/");
  const conn = createConn(req);
  const updated = assign(conn, { userId: 1 });
  expect(updated.assigns.userId).toBe(1);
  expect(conn.assigns.userId).toBeUndefined();
});

test("putHeader adds response header immutably", () => {
  const req = new Request("http://localhost:3000/");
  const conn = createConn(req);
  const updated = putHeader(conn, "x-custom", "value");
  expect(updated.respHeaders.get("x-custom")).toBe("value");
  expect(conn.respHeaders.get("x-custom")).toBeNull();
});

test("halt sets halted and status", () => {
  const req = new Request("http://localhost:3000/");
  const conn = createConn(req);
  const halted = halt(conn, 401, { error: "unauthorized" });
  expect(halted.halted).toBe(true);
  expect(halted.status).toBe(401);
  expect(halted.body).toEqual({ error: "unauthorized" });
  expect(conn.halted).toBe(false);
});
