import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  formatScope,
  includesScopes,
  isAllowedRedirect,
  newUserCode,
  normalizeUserCode,
  parseScope,
  randomId,
  sha256,
  shortId,
  verifyPkceS256,
} from "../helpers";

test("randomId returns a base64url string of the requested length", () => {
  const a = randomId(32);
  const b = randomId(32);
  expect(a).not.toBe(b);
  expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
});

test("shortId is prefixed and has stable shape", () => {
  const id = shortId();
  expect(id.startsWith("cli_")).toBe(true);
  expect(id.length).toBe(28); // "cli_" + 24 hex chars
});

test("shortId accepts a custom prefix", () => {
  expect(shortId("app").startsWith("app_")).toBe(true);
});

test("verifyPkceS256 accepts the spec example", () => {
  // Per RFC 7636 §A: verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
  // → challenge "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
  expect(verifyPkceS256(verifier, challenge)).toBe(true);
});

test("verifyPkceS256 rejects mismatches", () => {
  expect(verifyPkceS256("a".repeat(43), "wrongchallenge")).toBe(false);
});

test("verifyPkceS256 rejects too-short and too-long verifiers", () => {
  const challenge = "anything";
  expect(verifyPkceS256("a".repeat(42), challenge)).toBe(false);
  expect(verifyPkceS256("a".repeat(129), challenge)).toBe(false);
});

test("sha256 produces hex matching node:crypto", () => {
  const expected = createHash("sha256").update("hello").digest("hex");
  expect(sha256("hello")).toBe(expected);
});

test("parseScope handles whitespace, empty, null, undefined", () => {
  expect(parseScope("read write share")).toEqual(["read", "write", "share"]);
  expect(parseScope("  read   write  ")).toEqual(["read", "write"]);
  expect(parseScope("")).toEqual([]);
  expect(parseScope(null)).toEqual([]);
  expect(parseScope(undefined)).toEqual([]);
});

test("formatScope joins with single spaces", () => {
  expect(formatScope(["read", "write"])).toBe("read write");
});

test("includesScopes is a subset check", () => {
  expect(includesScopes(["read", "write", "share"], ["read"])).toBe(true);
  expect(includesScopes(["read", "write"], ["read", "write"])).toBe(true);
  expect(includesScopes(["read"], ["read", "write"])).toBe(false);
  expect(includesScopes([], [])).toBe(true);
});

test("isAllowedRedirect requires exact-string match", () => {
  const allowed = ["https://example.com/cb", "myapp://callback"];
  expect(isAllowedRedirect("https://example.com/cb", allowed)).toBe(true);
  expect(isAllowedRedirect("myapp://callback", allowed)).toBe(true);
  // Even prefix matches must be rejected.
  expect(isAllowedRedirect("https://example.com/cb/x", allowed)).toBe(false);
  expect(isAllowedRedirect("https://example.com/CB", allowed)).toBe(false);
  expect(isAllowedRedirect("https://evil.com/cb", allowed)).toBe(false);
});

test("newUserCode uses the unambiguous alphabet and a dash", () => {
  const code = newUserCode();
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  // No I, L, O, 0, 1.
  expect(code).not.toMatch(/[ILO01]/);
});

test("normalizeUserCode strips whitespace and dashes, uppercases", () => {
  expect(normalizeUserCode("abcd-efgh")).toBe("ABCD-EFGH");
  expect(normalizeUserCode(" a b c d e f g h ")).toBe("ABCD-EFGH");
  expect(normalizeUserCode("ABCDEFGH")).toBe("ABCD-EFGH");
});

test("normalizeUserCode returns short input unchanged (no dash insertion)", () => {
  expect(normalizeUserCode("abc")).toBe("ABC");
  expect(normalizeUserCode("")).toBe("");
});
