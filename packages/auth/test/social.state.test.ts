import { expect, test } from "bun:test";
import {
  clearStateCookieHeader,
  computeCodeChallenge,
  createState,
  generateCodeVerifier,
  readStateCookie,
  setStateCookieHeader,
  verifyState,
} from "../social/state/index.ts";

const SECRET = "test-state-secret";

test("generateCodeVerifier returns 43-char base64url (32-byte entropy)", () => {
  const v = generateCodeVerifier();
  expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

test("computeCodeChallenge yields S256 base64url of verifier", async () => {
  const challenge = await computeCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
  expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("createState issues a state token with the right shape", async () => {
  const s = await createState(SECRET, "google", "/home");
  expect(s.stateToken.split(".")).toHaveLength(3);
  expect(s.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(s.codeChallenge.length).toBeGreaterThan(20);
  expect(s.nonce.length).toBeGreaterThan(8);
});

test("verifyState accepts matching cookie and state param", async () => {
  const s = await createState(SECRET, "github");
  const payload = await verifyState(SECRET, s.stateToken, s.stateToken, "github");
  expect(payload.provider).toBe("github");
  expect(payload.codeVerifier).toBe(s.codeVerifier);
});

test("verifyState rejects missing cookie", async () => {
  const s = await createState(SECRET, "github");
  expect(() => verifyState(SECRET, null, s.stateToken, "github")).toThrow(/cookie/);
});

test("verifyState rejects missing state param", async () => {
  const s = await createState(SECRET, "github");
  expect(() => verifyState(SECRET, s.stateToken, null, "github")).toThrow(/state/);
});

test("verifyState rejects cookie/state mismatch", async () => {
  const a = await createState(SECRET, "google");
  const b = await createState(SECRET, "google");
  expect(() => verifyState(SECRET, a.stateToken, b.stateToken, "google")).toThrow(/mismatch/);
});

test("verifyState rejects provider mismatch", async () => {
  const s = await createState(SECRET, "github");
  expect(() => verifyState(SECRET, s.stateToken, s.stateToken, "google")).toThrow(/provider/);
});

test("verifyState rejects tampered token", async () => {
  const s = await createState(SECRET, "github");
  expect(() => verifyState("wrong-secret", s.stateToken, s.stateToken, "github")).toThrow();
});

test("setStateCookieHeader serializes HttpOnly + SameSite + Secure by default", () => {
  const header = setStateCookieHeader("abc.def.ghi");
  expect(header).toContain("_atlas_oauth_state=abc.def.ghi");
  expect(header).toContain("HttpOnly");
  expect(header).toContain("SameSite=lax");
  expect(header).toContain("Secure");
  expect(header).toContain("Max-Age=600");
});

test("setStateCookieHeader honors override options", () => {
  const header = setStateCookieHeader("v", { name: "x_state", path: "/auth", secure: false, sameSite: "strict" });
  expect(header).toContain("x_state=v");
  expect(header).toContain("Path=/auth");
  expect(header).toContain("SameSite=strict");
  expect(header).not.toContain("Secure");
});

test("clearStateCookieHeader emits Max-Age=0", () => {
  expect(clearStateCookieHeader()).toContain("Max-Age=0");
});

test("readStateCookie parses the cookie header", () => {
  expect(readStateCookie("foo=1; _atlas_oauth_state=abc.def; bar=2")).toBe("abc.def");
});

test("readStateCookie returns null when absent", () => {
  expect(readStateCookie(null)).toBe(null);
  expect(readStateCookie("foo=1; bar=2")).toBe(null);
});

test("readStateCookie respects a custom name", () => {
  expect(readStateCookie("x_state=token", { name: "x_state" })).toBe("token");
});
