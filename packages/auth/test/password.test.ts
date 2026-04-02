import { expect, test } from "bun:test";
import { hash, verify } from "../password/index.ts";

test("hash and verify password", async () => {
  const hashed = await hash("secret123");
  expect(hashed).not.toBe("secret123");
  expect(await verify("secret123", hashed)).toBe(true);
  expect(await verify("wrong", hashed)).toBe(false);
});

test("hash produces different outputs for same input", async () => {
  const a = await hash("password");
  const b = await hash("password");
  expect(a).not.toBe(b);
});
