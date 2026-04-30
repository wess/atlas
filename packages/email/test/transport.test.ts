import { expect, test } from "bun:test";
import { createConsoleEmailer, createEmailer, createResendEmailer } from "../transport";

test("console transport reports disabled and returns ok+logged", async () => {
  const m = createConsoleEmailer();
  expect(m.enabled).toBe(false);
  const res = await m.send({ to: "a@b", subject: "hi", html: "<p>hi</p>", text: "hi" });
  expect(res).toEqual({ ok: true, logged: true });
});

test("console transport accepts an array of recipients", async () => {
  const m = createConsoleEmailer();
  const res = await m.send({ to: ["a@b", "c@d"], subject: "hi", html: "<p>hi</p>" });
  expect(res.ok).toBe(true);
});

test("createEmailer with apiKey + from produces an enabled emailer", () => {
  const m = createEmailer({ apiKey: "secret", from: "no-reply@example.com" });
  expect(m.enabled).toBe(true);
});

test("createEmailer falls back to console when apiKey is missing", () => {
  const m = createEmailer({ apiKey: undefined, from: "no-reply@example.com" });
  expect(m.enabled).toBe(false);
});

test("createEmailer falls back to console when from is missing", () => {
  const m = createEmailer({ apiKey: "secret", from: null });
  expect(m.enabled).toBe(false);
});

test("createResendEmailer falls back to console when apiKey is blank", () => {
  const m = createResendEmailer({ apiKey: "   ", from: "no-reply@example.com" });
  expect(m.enabled).toBe(false);
});

test("createResendEmailer posts to the Resend endpoint", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
  }) as typeof fetch;
  try {
    const m = createResendEmailer({ apiKey: "key123", from: "no-reply@example.com" });
    const res = await m.send({
      to: "user@example.com",
      subject: "hi",
      html: "<p>hi</p>",
      text: "hi",
      replyTo: "ops@example.com",
    });
    expect(res).toEqual({ ok: true, id: "msg_1" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.from).toBe("no-reply@example.com");
    expect(body.to).toEqual(["user@example.com"]);
    expect(body.subject).toBe("hi");
    expect(body.reply_to).toBe("ops@example.com");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer key123");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("createResendEmailer surfaces non-2xx responses as ok:false", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
  try {
    const m = createResendEmailer({ apiKey: "key", from: "x@y" });
    const res = await m.send({ to: "u@e", subject: "s", html: "<p>h</p>" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("Resend 429");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("createResendEmailer surfaces fetch errors as ok:false", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  try {
    const m = createResendEmailer({ apiKey: "key", from: "x@y" });
    const res = await m.send({ to: "u@e", subject: "s", html: "<p>h</p>" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("network down");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("send-time `from` overrides the transport default", async () => {
  let capturedFrom: string | undefined;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    capturedFrom = JSON.parse(String(init?.body)).from;
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  }) as typeof fetch;
  try {
    const m = createResendEmailer({ apiKey: "k", from: "default@x" });
    await m.send({ to: "u@e", subject: "s", html: "<p>h</p>", from: "override@x" });
    expect(capturedFrom).toBe("override@x");
  } finally {
    globalThis.fetch = realFetch;
  }
});
