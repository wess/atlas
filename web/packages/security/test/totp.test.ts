import { expect, test } from "bun:test";
import {
  base32Decode,
  base32Encode,
  generateBackupCodes,
  generateSecret,
  otpauthUrl,
  totpAt,
  verifyTotp,
} from "../totp";

test("base32 round-trips", () => {
  const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff]);
  expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
});

test("base32Decode rejects invalid characters", () => {
  expect(() => base32Decode("AAAA1AAA")).toThrow("Invalid base32 character");
});

test("generateSecret returns a non-empty base32 string", () => {
  const s = generateSecret();
  expect(s.length).toBeGreaterThanOrEqual(32);
  expect(s).toMatch(/^[A-Z2-7]+$/);
});

test("totpAt is deterministic for a given time", () => {
  const secret = "JBSWY3DPEHPK3PXP";
  const t = new Date(1_700_000_000 * 1000);
  const a = totpAt(secret, t);
  const b = totpAt(secret, t);
  expect(a).toBe(b);
  expect(a).toMatch(/^\d{6}$/);
});

test("verifyTotp accepts the current code", () => {
  const secret = generateSecret();
  const code = totpAt(secret);
  expect(verifyTotp(secret, code)).toBe(true);
});

test("verifyTotp rejects a wrong code", () => {
  const secret = generateSecret();
  expect(verifyTotp(secret, "000000")).toBe(false);
});

test("verifyTotp tolerates ±1 step within window", () => {
  const secret = generateSecret();
  const now = new Date();
  const earlier = new Date(now.getTime() - 30_000);
  const later = new Date(now.getTime() + 30_000);
  expect(verifyTotp(secret, totpAt(secret, earlier), { when: now, window: 1 })).toBe(true);
  expect(verifyTotp(secret, totpAt(secret, later), { when: now, window: 1 })).toBe(true);
});

test("verifyTotp rejects codes outside the window", () => {
  const secret = generateSecret();
  const now = new Date();
  const wayEarlier = new Date(now.getTime() - 5 * 60_000);
  expect(verifyTotp(secret, totpAt(secret, wayEarlier), { when: now, window: 1 })).toBe(false);
});

test("verifyTotp rejects malformed codes", () => {
  const secret = generateSecret();
  expect(verifyTotp(secret, "12345")).toBe(false);
  expect(verifyTotp(secret, "abcdef")).toBe(false);
  expect(verifyTotp(secret, "")).toBe(false);
});

test("verifyTotp tolerates whitespace in the code", () => {
  const secret = generateSecret();
  const code = totpAt(secret);
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  expect(verifyTotp(secret, spaced)).toBe(true);
});

test("otpauthUrl produces a parseable otpauth URI", () => {
  const url = otpauthUrl({ secret: "JBSWY3DPEHPK3PXP", account: "alice@example.com", issuer: "Atlas" });
  expect(url.startsWith("otpauth://totp/Atlas:alice%40example.com?")).toBe(true);
  expect(url).toContain("secret=JBSWY3DPEHPK3PXP");
  expect(url).toContain("issuer=Atlas");
  expect(url).toContain("digits=6");
  expect(url).toContain("period=30");
});

test("generateBackupCodes returns the requested count of formatted codes", () => {
  const codes = generateBackupCodes(8);
  expect(codes).toHaveLength(8);
  for (const c of codes) {
    expect(c).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
  }
  // Backup codes should be distinct.
  expect(new Set(codes).size).toBe(8);
});
