import { expect, test } from "bun:test";
import * as token from "../token/index.ts";

test("sign and verify JWT", async () => {
  const jwt = await token.sign({ userId: 1 }, "secret");
  const payload = await token.verify(jwt, "secret");
  expect(payload.userId).toBe(1);
  expect(payload.iat).toBeDefined();
});

test("verify rejects tampered token", async () => {
  const jwt = await token.sign({ userId: 1 }, "secret");
  expect(token.verify(`${jwt}x`, "secret")).rejects.toThrow();
});

test("verify rejects wrong secret", async () => {
  const jwt = await token.sign({ userId: 1 }, "secret");
  expect(token.verify(jwt, "wrong")).rejects.toThrow();
});

test("verify rejects expired token", async () => {
  const jwt = await token.sign({ userId: 1 }, "secret", { expiresIn: -1 });
  expect(token.verify(jwt, "secret")).rejects.toThrow("expired");
});

test("sign with expiresIn sets exp claim", async () => {
  const jwt = await token.sign({ userId: 1 }, "secret", { expiresIn: 3600 });
  const payload = await token.verify(jwt, "secret");
  expect(payload.exp).toBeDefined();
  expect(payload.exp! - payload.iat!).toBe(3600);
});

test("verify rejects invalid format", async () => {
  expect(token.verify("not.a.valid.jwt", "secret")).rejects.toThrow("Invalid token format");
  expect(token.verify("nope", "secret")).rejects.toThrow("Invalid token format");
});
