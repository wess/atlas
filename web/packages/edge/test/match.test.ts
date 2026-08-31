import { expect, test } from "bun:test";
import { isLocalHost, matchHost, matchRoute } from "../match/index.ts";

test("matchHost handles literal equality", () => {
  expect(matchHost("example.com", "example.com")).toBe(true);
  expect(matchHost("example.com:443", "example.com")).toBe(true);
  expect(matchHost("other.com", "example.com")).toBe(false);
});

test("matchHost handles wildcard patterns", () => {
  expect(matchHost("api.example.com", "*.example.com")).toBe(true);
  expect(matchHost("deep.api.example.com", "*.example.com")).toBe(true);
  expect(matchHost("example.com", "*.example.com")).toBe(false);
});

test("isLocalHost recognises localhost variants", () => {
  expect(isLocalHost("localhost")).toBe(true);
  expect(isLocalHost("dev.localhost")).toBe(true);
  expect(isLocalHost("127.0.0.1")).toBe(true);
  expect(isLocalHost("::1")).toBe(true);
  expect(isLocalHost("example.com")).toBe(false);
});

test("matchRoute path matchers", () => {
  const req = new Request("https://x.example/api/users");
  const url = new URL(req.url);
  expect(matchRoute(req, url, undefined)).toBe(true);
  expect(matchRoute(req, url, { path: "/api/users" })).toBe(true);
  expect(matchRoute(req, url, { path: "/api/*" })).toBe(true);
  expect(matchRoute(req, url, { path: /\/users$/ })).toBe(true);
  expect(matchRoute(req, url, { path: "/other" })).toBe(false);
});

test("matchRoute method matchers", () => {
  const req = new Request("https://x.example/", { method: "POST" });
  const url = new URL(req.url);
  expect(matchRoute(req, url, { method: "POST" })).toBe(true);
  expect(matchRoute(req, url, { method: ["GET", "POST"] })).toBe(true);
  expect(matchRoute(req, url, { method: "GET" })).toBe(false);
});
