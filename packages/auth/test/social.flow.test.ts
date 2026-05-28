import { expect, test } from "bun:test";
import { createConn, json } from "../../server/index.ts";
import { socialAuth } from "../social/index.ts";
import type { SocialProvider } from "../social/providers/index.ts";

const fakeProvider = (name: string, opts?: { failExchange?: boolean }): SocialProvider => {
  let lastVerifier: string | null = null;
  return {
    name,
    config: {},
    defaultScopes: ["openid", "email"],
    authorizeUrl: (params) =>
      `https://example.test/${name}/authorize?state=${encodeURIComponent(params.state)}&challenge=${encodeURIComponent(params.codeChallenge)}`,
    exchange: async (params) => {
      lastVerifier = params.codeVerifier;
      if (opts?.failExchange) throw new Error("exchange failed");
      return { accessToken: `tok-${params.code}`, raw: { access_token: `tok-${params.code}` } };
    },
    profile: async (tokens) => ({
      provider: name,
      id: "u-1",
      email: "u@example.com",
      emailVerified: true,
      name: "U",
      raw: { token: tokens.accessToken, lastVerifier },
    }),
  };
};

const SECRET = "test-flow-secret";

test("authorize() returns a provider URL + a state cookie", async () => {
  const social = socialAuth({
    secret: SECRET,
    providers: { mock: fakeProvider("mock") },
  });
  const { url, cookie } = await social.authorize("mock", { returnTo: "/after" });
  expect(url.startsWith("https://example.test/mock/authorize?state=")).toBe(true);
  expect(cookie).toContain("_atlas_oauth_state=");
  expect(cookie).toContain("HttpOnly");
});

test("authorize() throws for unknown provider", async () => {
  const social = socialAuth({ secret: SECRET, providers: { mock: fakeProvider("mock") } });
  expect(() => social.authorize("nope")).toThrow(/Unknown social provider/);
});

test("start() pipe sets cookie and redirects", async () => {
  const social = socialAuth({ secret: SECRET, providers: { mock: fakeProvider("mock") } });
  const conn = createConn(new Request("http://localhost/login/mock"));
  const result = await social.start("mock")(conn);
  expect(result.halted).toBe(true);
  expect(result.status).toBe(302);
  expect(result.respHeaders.get("location")?.startsWith("https://example.test/mock/authorize")).toBe(true);
  expect(result.respHeaders.get("set-cookie")?.startsWith("_atlas_oauth_state=")).toBe(true);
});

test("callback() exchanges code + invokes onSuccess with profile + tokens", async () => {
  const social = socialAuth({ secret: SECRET, providers: { mock: fakeProvider("mock") } });
  const { url, cookie } = await social.authorize("mock", { returnTo: "/welcome" });
  const stateToken = new URL(url).searchParams.get("state") as string;
  const cookieValue = (cookie.split(";")[0] as string).split("=")[1] as string;

  const cbReq = new Request(`http://localhost/cb?code=AUTHCODE&state=${encodeURIComponent(stateToken)}`, {
    headers: { cookie: `_atlas_oauth_state=${cookieValue}` },
  });
  const conn = createConn(cbReq);

  let captured: { profile: unknown; returnTo: string | undefined } | null = null;
  const pipe = social.callback("mock", {
    onSuccess: async (c, result) => {
      captured = { profile: result.profile, returnTo: result.returnTo };
      return json(c, 200, { ok: true });
    },
  });
  const result = await pipe(conn);

  expect(result.status).toBe(200);
  expect(captured).not.toBeNull();
  expect((captured as any).profile.id).toBe("u-1");
  expect((captured as any).returnTo).toBe("/welcome");
  expect(result.respHeaders.get("set-cookie")?.includes("Max-Age=0")).toBe(true);
});

test("callback() halts 400 when state cookie is missing", async () => {
  const social = socialAuth({ secret: SECRET, providers: { mock: fakeProvider("mock") } });
  const conn = createConn(new Request("http://localhost/cb?code=AUTHCODE&state=anything"));
  const pipe = social.callback("mock", { onSuccess: async (c) => c });
  const result = await pipe(conn);
  expect(result.halted).toBe(true);
  expect(result.status).toBe(400);
});

test("callback() surfaces provider error via onError", async () => {
  const social = socialAuth({ secret: SECRET, providers: { mock: fakeProvider("mock") } });
  const conn = createConn(new Request("http://localhost/cb?error=access_denied"));
  let captured: Error | null = null;
  const result = await social.callback("mock", {
    onSuccess: async (c) => c,
    onError: async (c, err) => {
      captured = err;
      return json(c, 401, { error: err.message });
    },
  })(conn);
  expect(result.status).toBe(401);
  expect(captured?.message).toContain("access_denied");
});

test("callback() halts 400 when exchange throws", async () => {
  const social = socialAuth({ secret: SECRET, providers: { mock: fakeProvider("mock", { failExchange: true }) } });
  const { url, cookie } = await social.authorize("mock");
  const stateToken = new URL(url).searchParams.get("state") as string;
  const cookieValue = (cookie.split(";")[0] as string).split("=")[1] as string;
  const conn = createConn(
    new Request(`http://localhost/cb?code=X&state=${encodeURIComponent(stateToken)}`, {
      headers: { cookie: `_atlas_oauth_state=${cookieValue}` },
    }),
  );
  const result = await social.callback("mock", { onSuccess: async (c) => c })(conn);
  expect(result.halted).toBe(true);
  expect(result.status).toBe(400);
});
