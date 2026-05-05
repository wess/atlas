import { expect, test } from "bun:test";
import { b64url } from "../acme/base64.ts";
import { signJws } from "../acme/jws.ts";
import { generateKeyPair, jwkThumbprint } from "../acme/keys.ts";

test("signJws produces verifiable ES256 signature", async () => {
  const kp = await generateKeyPair();
  const header = { alg: "ES256" as const, nonce: "n", url: "https://x", jwk: kp.jwk };
  const signed = await signJws(kp.privateKey, header, { ok: true });

  const signingInput = new TextEncoder().encode(`${signed.protected}.${signed.payload}`);
  const sigBytes = Uint8Array.from(
    atob(
      signed.signature
        .replaceAll("-", "+")
        .replaceAll("_", "/")
        .padEnd(Math.ceil(signed.signature.length / 4) * 4, "="),
    ),
    (c) => c.charCodeAt(0),
  );

  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    kp.publicKey,
    new Uint8Array(sigBytes).buffer as ArrayBuffer,
    signingInput,
  );
  expect(ok).toBe(true);
});

test("jwkThumbprint is stable + base64url-encoded", async () => {
  const kp = await generateKeyPair();
  const a = await jwkThumbprint(kp.jwk);
  const b = await jwkThumbprint(kp.jwk);
  expect(a).toBe(b);
  expect(a).not.toContain("=");
  expect(a).not.toContain("+");
  expect(a).not.toContain("/");
});

test("b64url encodes without padding or url-unsafe chars", () => {
  const out = b64url(new Uint8Array([0xff, 0xfe, 0xfd, 0x00]));
  expect(out).not.toContain("=");
  expect(out).not.toContain("+");
  expect(out).not.toContain("/");
});
