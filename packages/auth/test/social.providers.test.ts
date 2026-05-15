import { expect, test } from "bun:test";
import { apple, facebook, github, google, microsoft, tiktok, twitter } from "../social/index.ts";

const baseParams = {
  state: "state-token",
  codeChallenge: "challenge",
};

test("google authorizeUrl carries PKCE + scopes + offline access", () => {
  const url = google({
    clientId: "cid",
    clientSecret: "csec",
    redirectUri: "https://app.example.com/cb",
  }).authorizeUrl(baseParams);
  const u = new URL(url);
  expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  expect(u.searchParams.get("client_id")).toBe("cid");
  expect(u.searchParams.get("redirect_uri")).toBe("https://app.example.com/cb");
  expect(u.searchParams.get("scope")).toBe("openid email profile");
  expect(u.searchParams.get("state")).toBe("state-token");
  expect(u.searchParams.get("code_challenge")).toBe("challenge");
  expect(u.searchParams.get("code_challenge_method")).toBe("S256");
  expect(u.searchParams.get("access_type")).toBe("offline");
});

test("google authorizeUrl honors prompt + hostedDomain + extraParams", () => {
  const url = google({
    clientId: "cid",
    clientSecret: "csec",
    redirectUri: "https://app.example.com/cb",
    prompt: "consent",
    hostedDomain: "example.com",
  }).authorizeUrl({ ...baseParams, scopes: ["openid"], extraParams: { login_hint: "user@example.com" } });
  const u = new URL(url);
  expect(u.searchParams.get("scope")).toBe("openid");
  expect(u.searchParams.get("prompt")).toBe("consent");
  expect(u.searchParams.get("hd")).toBe("example.com");
  expect(u.searchParams.get("login_hint")).toBe("user@example.com");
});

test("github authorizeUrl uses correct endpoint and scopes", () => {
  const url = github({ clientId: "c", clientSecret: "s", redirectUri: "https://x/cb" }).authorizeUrl(baseParams);
  const u = new URL(url);
  expect(u.origin + u.pathname).toBe("https://github.com/login/oauth/authorize");
  expect(u.searchParams.get("scope")).toBe("read:user user:email");
});

test("github allowSignup=false propagates to authorize URL", () => {
  const url = github({
    clientId: "c",
    clientSecret: "s",
    redirectUri: "https://x/cb",
    allowSignup: false,
  }).authorizeUrl(baseParams);
  expect(new URL(url).searchParams.get("allow_signup")).toBe("false");
});

test("microsoft authorizeUrl falls back to tenant=common", () => {
  const url = microsoft({ clientId: "c", clientSecret: "s", redirectUri: "https://x/cb" }).authorizeUrl(baseParams);
  expect(url.startsWith("https://login.microsoftonline.com/common/oauth2/v2.0/authorize")).toBe(true);
});

test("microsoft authorizeUrl honors explicit tenant", () => {
  const url = microsoft({
    clientId: "c",
    clientSecret: "s",
    redirectUri: "https://x/cb",
    tenant: "contoso.onmicrosoft.com",
  }).authorizeUrl(baseParams);
  expect(url.startsWith("https://login.microsoftonline.com/contoso.onmicrosoft.com/oauth2/v2.0/authorize")).toBe(true);
});

test("facebook authorizeUrl uses comma-joined scopes and v19 by default", () => {
  const url = facebook({ clientId: "c", clientSecret: "s", redirectUri: "https://x/cb" }).authorizeUrl(baseParams);
  const u = new URL(url);
  expect(u.origin + u.pathname).toBe("https://www.facebook.com/v19.0/dialog/oauth");
  expect(u.searchParams.get("scope")).toBe("email,public_profile");
});

test("apple authorizeUrl defaults to form_post response mode", () => {
  const url = apple({
    clientId: "com.example.app",
    teamId: "T123",
    keyId: "K123",
    privateKey: "-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----",
    redirectUri: "https://x/cb",
  }).authorizeUrl(baseParams);
  const u = new URL(url);
  expect(u.origin + u.pathname).toBe("https://appleid.apple.com/auth/authorize");
  expect(u.searchParams.get("response_mode")).toBe("form_post");
  expect(u.searchParams.get("scope")).toBe("name email");
});

test("twitter authorizeUrl carries PKCE and offline scope", () => {
  const url = twitter({ clientId: "c", redirectUri: "https://x/cb" }).authorizeUrl(baseParams);
  const u = new URL(url);
  expect(u.origin + u.pathname).toBe("https://twitter.com/i/oauth2/authorize");
  expect((u.searchParams.get("scope") ?? "").split(" ")).toContain("offline.access");
});

test("tiktok authorizeUrl uses client_key + comma-joined scopes", () => {
  const url = tiktok({
    clientKey: "awxyz",
    clientSecret: "s",
    redirectUri: "https://x/cb",
  }).authorizeUrl({ ...baseParams, scopes: ["user.info.basic", "video.list"] });
  const u = new URL(url);
  expect(u.origin + u.pathname).toBe("https://www.tiktok.com/v2/auth/authorize/");
  expect(u.searchParams.get("client_key")).toBe("awxyz");
  expect(u.searchParams.get("client_id")).toBe(null);
  expect(u.searchParams.get("scope")).toBe("user.info.basic,video.list");
  expect(u.searchParams.get("code_challenge_method")).toBe("S256");
});
