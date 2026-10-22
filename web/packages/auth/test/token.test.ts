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

test("JWT expiry is exclusive and numeric; future nbf is rejected", async () => {
  for (const exp of [0, Math.floor(Date.now() / 1000), "never", null]) {
    const jwt = await token.sign({ exp } as token.TokenPayload, "secret");
    await expect(token.verify(jwt, "secret")).rejects.toThrow();
  }
  await expect(token.verify(await token.sign({ sub: "1" }, "secret", { expiresIn: 0 }), "secret")).rejects.toThrow(
    "expired",
  );
  await expect(token.verify(await token.sign({ nbf: Date.now() / 1000 + 100 }, "secret"), "secret")).rejects.toThrow(
    "not active",
  );
});

test("HS256 verification rejects a signed header declaring another algorithm", async () => {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: "1" })).toString("base64url");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`));
  await expect(
    token.verify(`${header}.${payload}.${Buffer.from(sig).toString("base64url")}`, "secret"),
  ).rejects.toThrow("algorithm");
});

test("RS256 enforces expiry and signing key usage", async () => {
  const key = await token.generateRs256KeyPair();
  const expired = await token.signRs256({ exp: 0 }, key);
  await expect(token.verifyRs256(expired, { keys: [key.publicJwk] })).rejects.toThrow("expired");
  const valid = await token.signRs256({ sub: "1" }, key, { expiresIn: 60 });
  expect((await token.verifyRs256(valid, { keys: [key.publicJwk] })).sub).toBe("1");
  await expect(token.verifyRs256(valid, { keys: [{ ...key.publicJwk, use: "enc" }] })).rejects.toThrow();
});
