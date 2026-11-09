import { afterEach, expect, spyOn, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import { createConn, json } from "../../server/index.ts";
import { apple, localReturnPath, socialAuth } from "../social/index.ts";
import type { SocialProvider } from "../social/providers/index.ts";

const SECRET = "shared-app-secret";

const spies: { mockRestore: () => void }[] = [];
afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore();
});
const quiet = () => {
  const spy = spyOn(console, "error").mockImplementation(() => {});
  spies.push(spy);
  return spy;
};

test("localReturnPath refuses paths a browser would take off-site", () => {
  for (const bad of [
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/\u0000/evil.example",
    "/\\evil.example",
    "//evil.example",
    "https://evil.example",
    "evil.example",
    "",
  ]) {
    expect(localReturnPath(bad)).toBeNull();
  }
  expect(localReturnPath("/dashboard?tab=1#x")).toBe("/dashboard?tab=1#x");
});

const mockProvider = (fail?: string): SocialProvider => ({
  name: "mock",
  config: {},
  defaultScopes: [],
  authorizeUrl: ({ state }) => `https://provider.test/auth?state=${state}`,
  exchange: async () => {
    if (fail) throw new Error(fail);
    return { accessToken: "t", raw: {} };
  },
  profile: async () => ({ provider: "mock", id: "1", raw: {} }),
});

test("social returnTo must be local or explicitly allowed", async () => {
  const social = socialAuth({ secret: SECRET, providers: { mock: mockProvider() } });
  await expect(social.authorize("mock", { returnTo: "/\t/evil.example" })).rejects.toThrow(/returnTo/);
  await expect(social.authorize("mock", { returnTo: "https://evil.example" })).rejects.toThrow(/returnTo/);
  await social.authorize("mock", { returnTo: "/welcome" });
  const native = socialAuth({
    secret: SECRET,
    providers: { mock: mockProvider() },
    allowedReturnTo: ["myapp://auth"],
  });
  await native.authorize("mock", { returnTo: "myapp://auth" });
});

test("social callback errors don't echo provider responses to the browser", async () => {
  quiet();
  const social = socialAuth({
    secret: SECRET,
    providers: { mock: mockProvider("provider said: client_secret=abc invalid") },
  });
  const { url, cookie } = await social.authorize("mock");
  const state = new URL(url).searchParams.get("state")!;
  const req = new Request(`http://localhost/cb?code=c&state=${state}`, {
    headers: { cookie: cookie.split(";")[0]! },
  });
  const result = await social.callback("mock", { onSuccess: (c) => json(c, 200, {}) })(createConn(req));
  expect(result.status).toBe(400);
  expect(JSON.stringify(result.body)).not.toContain("client_secret");
});

test("Apple's form_post callback gets a SameSite=None state cookie", async () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const config = { clientId: "c", teamId: "t", keyId: "k", privateKey: pem, redirectUri: "https://a.test/cb" };
  const social = socialAuth({
    secret: SECRET,
    providers: { apple: apple(config), query: { ...apple({ ...config, responseMode: "query" }), name: "query" } },
  });
  const { cookie } = await social.authorize("apple");
  expect(cookie).toContain("SameSite=none");
  expect(cookie).toContain("Secure");
  expect((await social.authorize("query")).cookie).toContain("SameSite=lax");
});
