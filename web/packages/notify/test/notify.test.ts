import { describe, expect, spyOn, test } from "bun:test";
import {
  createApnsProvider,
  createConsoleProvider,
  createFcmProvider,
  createNotifier,
  createNotifySubprocess,
  type NotifyProvider,
  serveNotify,
} from "../index";

const message = { to: { kind: "apns" as const, token: "device" }, title: "Hello", body: "World" };

const privateKeyPem = async (algorithm: EcKeyGenParams | RsaHashedKeyGenParams): Promise<string> => {
  const pair = (await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"])) as CryptoKeyPair;
  const bytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const base64 =
    Buffer.from(bytes)
      .toString("base64")
      .match(/.{1,64}/g)
      ?.join("\n") ?? "";
  return `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;
};

describe("notify", () => {
  test("dispatches to the matching provider", async () => {
    const provider: NotifyProvider = {
      name: "test",
      supports: (destination) => destination.kind === "apns",
      send: async () => ({ ok: true, provider: "test", id: "sent" }),
    };
    expect(await createNotifier([provider]).send(message)).toEqual({
      ok: true,
      provider: "test",
      id: "sent",
    });
  });

  test("returns a result when no provider is configured", async () => {
    expect(await createNotifier([]).send(message)).toEqual({
      ok: false,
      provider: "apns",
      error: "No apns notification provider is configured",
    });
  });

  test("serves an authenticated notification endpoint", async () => {
    const server = serveNotify({ notifier: createNotifier([createConsoleProvider()]), token: "secret" });
    const unauthorized = await fetch(new URL("/notify", server.url), { method: "POST", body: JSON.stringify(message) });
    expect(unauthorized.status).toBe(401);
    const response = await fetch(new URL("/notify", server.url), {
      method: "POST",
      headers: { authorization: "Bearer secret" },
      body: JSON.stringify(message),
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ ok: true, provider: "console", logged: true });
    await server.stop();
  });

  test("can isolate delivery in a subprocess", async () => {
    const worker = createNotifySubprocess({ config: { console: true } });
    expect(await worker.send(message)).toMatchObject({ ok: true, provider: "console", logged: true });
    await worker.close();
  });

  test("signs and translates an APNs request", async () => {
    const privateKey = await privateKeyPem({ name: "ECDSA", namedCurve: "P-256" });
    let request: { readonly input: string | URL | Request; readonly init?: RequestInit } | undefined;
    const fetchMock = spyOn(globalThis, "fetch").mockImplementation((async (input, init) => {
      request = { input, init };
      return new Response(null, { status: 200, headers: { "apns-id": "notification-id" } });
    }) as typeof globalThis.fetch);
    const provider = createApnsProvider({
      teamId: "team",
      keyId: "key",
      privateKey,
      topic: "dev.atlas.app",
      production: false,
    });
    const result = await provider.send({ ...message, data: { route: "/inbox" }, priority: "high" });
    fetchMock.mockRestore();

    expect(result).toEqual({ ok: true, provider: "apns", id: "notification-id" });
    expect(String(request?.input)).toBe("https://api.sandbox.push.apple.com/3/device/device");
    expect(new Headers(request?.init?.headers).get("apns-topic")).toBe("dev.atlas.app");
    expect(new Headers(request?.init?.headers).get("authorization")?.split(".")).toHaveLength(3);
    expect(JSON.parse(String(request?.init?.body))).toMatchObject({
      route: "/inbox",
      aps: { alert: { title: "Hello", body: "World" } },
    });
  });

  test("exchanges a service-account assertion and sends FCM HTTP v1", async () => {
    const privateKey = await privateKeyPem({
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    });
    const requests: Array<{ readonly input: string | URL | Request; readonly init?: RequestInit }> = [];
    const fetchMock = spyOn(globalThis, "fetch").mockImplementation((async (input, init) => {
      requests.push({ input, init });
      if (requests.length === 1) return Response.json({ access_token: "access", expires_in: 3600 });
      return Response.json({ name: "projects/atlas/messages/message-id" });
    }) as typeof globalThis.fetch);
    const provider = createFcmProvider({ projectId: "atlas", clientEmail: "notify@atlas.test", privateKey });
    const result = await provider.send({
      to: { kind: "fcm", topic: "updates" },
      title: "Hello",
      body: "World",
      data: { route: "/inbox" },
    });
    fetchMock.mockRestore();

    expect(result).toEqual({ ok: true, provider: "fcm", id: "projects/atlas/messages/message-id" });
    expect(String(requests[0]?.input)).toBe("https://oauth2.googleapis.com/token");
    expect(String(requests[1]?.input)).toBe("https://fcm.googleapis.com/v1/projects/atlas/messages:send");
    expect(new Headers(requests[1]?.init?.headers).get("authorization")).toBe("Bearer access");
    expect(JSON.parse(String(requests[1]?.init?.body))).toMatchObject({
      message: { topic: "updates", notification: { title: "Hello", body: "World" }, data: { route: "/inbox" } },
    });
  });
});
