import { expect, test } from "bun:test";
import { createConn } from "../conn/index.ts";
import { isJsonContentType, parseJson } from "../parsers/index.ts";

test("isJsonContentType judges the MIME essence", () => {
  expect(isJsonContentType("application/json")).toBe(true);
  expect(isJsonContentType("Application/JSON; charset=utf-8")).toBe(true);
  expect(isJsonContentType("application/merge-patch+json")).toBe(true);
  expect(isJsonContentType("application/vnd.api+json")).toBe(true);
  expect(isJsonContentType("text/plain; x=application/json")).toBe(false);
  expect(isJsonContentType("text/plain;application/json")).toBe(false);
  expect(isJsonContentType("application/jsonx")).toBe(false);
  expect(isJsonContentType("multipart/form-data; boundary=application/json")).toBe(false);
  expect(isJsonContentType(null)).toBe(false);
});

test("parseJson ignores a text/plain body that mentions application/json", async () => {
  const req = new Request("http://x/", {
    method: "POST",
    headers: { "content-type": "text/plain; x=application/json" },
    body: JSON.stringify({ admin: true }),
  });
  const conn = await parseJson(createConn(req));
  // left untouched: body is still the raw Request, not the parsed object
  expect(conn.body).toBe(req);
});

test("parseJson still parses application/json", async () => {
  const req = new Request("http://x/", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ a: 1 }),
  });
  const conn = await parseJson(createConn(req));
  expect(conn.body).toEqual({ a: 1 });
});
