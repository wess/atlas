import { expect, test } from "bun:test";
import type { Emailer, EmailMessage } from "@atlas/email";
import { renderShareEmailMessage, shareEmail } from "../email/index.ts";

const captureEmailer = (): { emailer: Emailer; sent: EmailMessage[] } => {
  const sent: EmailMessage[] = [];
  const emailer: Emailer = {
    enabled: true,
    send: async (msg) => {
      sent.push(msg);
      return { ok: true, id: "test-1" };
    },
  };
  return { emailer, sent };
};

test("renderShareEmailMessage builds a subject naming the sharer", () => {
  const out = renderShareEmailMessage({
    emailer: { enabled: false, send: async () => ({ ok: true }) },
    to: "friend@example.com",
    sharerName: "Wess",
    product: "Atlas",
    content: { url: "https://example.com/x", title: "Cool post" },
  });
  expect(out.subject).toBe('Wess shared a link on Atlas: "Cool post"');
  expect(out.html).toContain("https://example.com/x");
  expect(out.text).toContain("https://example.com/x");
});

test("renderShareEmailMessage escapes user-supplied strings", () => {
  const out = renderShareEmailMessage({
    emailer: { enabled: false, send: async () => ({ ok: true }) },
    to: "x@x",
    sharerName: "<script>alert(1)</script>",
    content: { url: "https://x", title: "<b>bad</b>", text: "& friends" },
    message: "<img onerror=alert(1)>",
  });
  expect(out.html).not.toContain("<script>alert(1)</script>");
  expect(out.html).not.toContain("<img onerror=alert(1)>");
  expect(out.html).toContain("&lt;script&gt;");
  expect(out.html).toContain("&amp; friends");
});

test("renderShareEmailMessage falls back to 'Someone' when sharerName is missing", () => {
  const out = renderShareEmailMessage({
    emailer: { enabled: false, send: async () => ({ ok: true }) },
    to: "x@x",
    content: { url: "https://x" },
  });
  expect(out.subject.startsWith("Someone shared")).toBe(true);
});

test("shareEmail dispatches through the configured Emailer", async () => {
  const { emailer, sent } = captureEmailer();
  const result = await shareEmail({
    emailer,
    to: "friend@example.com",
    sharerName: "Wess",
    replyTo: "wess@example.com",
    content: { url: "https://example.com/x", title: "Hi" },
  });
  expect(result.ok).toBe(true);
  expect(sent).toHaveLength(1);
  expect(sent[0]?.to).toBe("friend@example.com");
  expect(sent[0]?.replyTo).toBe("wess@example.com");
  expect(sent[0]?.subject).toContain("Wess shared");
});
