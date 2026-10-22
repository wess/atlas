import { expect, test } from "bun:test";
import { verifyIdToken } from "../social/http/oidc.ts";
import * as jwt from "../token/index.ts";

test("provider tokens verify signatures, audience and issuer; JWKS caching handles rotation", async () => {
  const first = await jwt.generateRs256KeyPair();
  const second = await jwt.generateRs256KeyPair();
  let published = first;
  let fetches = 0;
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch() {
      fetches++;
      return Response.json({ keys: [published.publicJwk] });
    },
  });
  const url = server.url.href;
  const claims = { sub: "user", iss: "https://issuer.test", aud: "client" };
  const verify = (token: string) => verifyIdToken(token, "client", url, (payload) => payload.iss === claims.iss);
  try {
    const token = await jwt.signRs256(claims, first, { expiresIn: 60 });
    await Promise.all(Array.from({ length: 20 }, () => verify(token)));
    expect(fetches).toBe(1);
    for (const overrides of [
      { aud: "other" },
      { iss: "https://other.test" },
      { aud: ["client", "other"], azp: "other" },
    ]) {
      await expect(verify(await jwt.signRs256({ ...claims, ...overrides }, first, { expiresIn: 60 }))).rejects.toThrow(
        "claims",
      );
    }
    await expect(verify(await jwt.sign(claims, "wrong"))).rejects.toThrow();
    published = second;
    expect((await verify(await jwt.signRs256(claims, second, { expiresIn: 60 }))).sub).toBe("user");
    expect(fetches).toBe(2);
    for (let i = 0; i < 3; i++) {
      await expect(
        verify(await jwt.signRs256(claims, { ...first, kid: `unknown-${i}` }, { expiresIn: 60 })),
      ).rejects.toThrow();
    }
    expect(fetches).toBe(2);
  } finally {
    server.stop(true);
  }
});
