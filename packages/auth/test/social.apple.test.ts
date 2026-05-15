import { expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";

const { apple } = await import("../social/providers/apple/index.ts");

const generateEcKey = (): string => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return privateKey.export({ type: "pkcs8", format: "pem" }) as string;
};

test("apple authorizeUrl builds a valid Apple authorize URL", () => {
  const provider = apple({
    clientId: "com.example.app",
    teamId: "T1",
    keyId: "K1",
    privateKey: generateEcKey(),
    redirectUri: "https://example.com/cb",
  });
  const url = provider.authorizeUrl({ state: "S", codeChallenge: "C" });
  const u = new URL(url);
  expect(u.searchParams.get("client_id")).toBe("com.example.app");
  expect(u.searchParams.get("response_type")).toBe("code");
  expect(u.searchParams.get("scope")).toBe("name email");
});

test("apple exchange mints an ES256 JWT client_secret with kid+alg headers", async () => {
  const privateKey = generateEcKey();
  const provider = apple({
    clientId: "com.example.app",
    teamId: "T1",
    keyId: "K1",
    privateKey,
    redirectUri: "https://example.com/cb",
  });

  let capturedSecret: string | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = new URLSearchParams(init.body as string);
    capturedSecret = body.get("client_secret");
    return new Response(JSON.stringify({ access_token: "at", id_token: "h.eyJzdWIiOiJ1MSJ9.s" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await provider.exchange({ code: "C", codeVerifier: "V" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(capturedSecret).toBeTruthy();
  const parts = (capturedSecret as unknown as string).split(".");
  expect(parts).toHaveLength(3);
  const header = JSON.parse(Buffer.from(parts[0] as string, "base64url").toString("utf8"));
  expect(header.alg).toBe("ES256");
  expect(header.kid).toBe("K1");
  expect(header.typ).toBe("JWT");
  const payload = JSON.parse(Buffer.from(parts[1] as string, "base64url").toString("utf8"));
  expect(payload.iss).toBe("T1");
  expect(payload.sub).toBe("com.example.app");
  expect(payload.aud).toBe("https://appleid.apple.com");
  expect(payload.exp).toBeGreaterThan(payload.iat);
});
