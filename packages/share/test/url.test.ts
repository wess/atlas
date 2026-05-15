import { expect, test } from "bun:test";
import { channels, listChannels, share, shareUrl } from "../index.ts";

const base = { url: "https://example.com/post/123", title: "Look at this", text: "A short blurb" };

test("twitter intent URL carries url + text + hashtags + via", () => {
  const u = new URL(shareUrl("twitter", { ...base, hashtags: ["atlas", "bun"], via: "atlas" }));
  expect(u.origin + u.pathname).toBe("https://twitter.com/intent/tweet");
  expect(u.searchParams.get("url")).toBe(base.url);
  expect(u.searchParams.get("text")).toBe(base.text);
  expect(u.searchParams.get("hashtags")).toBe("atlas,bun");
  expect(u.searchParams.get("via")).toBe("atlas");
});

test("facebook sharer URL uses 'u' and 'quote'", () => {
  const u = new URL(shareUrl("facebook", base));
  expect(u.origin + u.pathname).toBe("https://www.facebook.com/sharer/sharer.php");
  expect(u.searchParams.get("u")).toBe(base.url);
  expect(u.searchParams.get("quote")).toBe(base.text);
});

test("linkedin share-offsite uses 'url' only", () => {
  const u = new URL(shareUrl("linkedin", base));
  expect(u.origin + u.pathname).toBe("https://www.linkedin.com/sharing/share-offsite/");
  expect(u.searchParams.get("url")).toBe(base.url);
});

test("reddit submit URL carries url + title", () => {
  const u = new URL(shareUrl("reddit", base));
  expect(u.origin + u.pathname).toBe("https://www.reddit.com/submit");
  expect(u.searchParams.get("url")).toBe(base.url);
  expect(u.searchParams.get("title")).toBe(base.title);
});

test("whatsapp wa.me URL concatenates title + text + url", () => {
  const u = new URL(shareUrl("whatsapp", base));
  expect(u.origin + u.pathname).toBe("https://wa.me/");
  expect(u.searchParams.get("text")).toContain(base.title);
  expect(u.searchParams.get("text")).toContain(base.text);
  expect(u.searchParams.get("text")).toContain(base.url);
});

test("telegram t.me/share/url carries url + text", () => {
  const u = new URL(shareUrl("telegram", base));
  expect(u.origin + u.pathname).toBe("https://t.me/share/url");
  expect(u.searchParams.get("url")).toBe(base.url);
  expect(u.searchParams.get("text")).toBe(base.text);
});

test("sms link with phone produces sms:<phone>?body=…", () => {
  const link = shareUrl("sms", { ...base, phone: "+15551234567" });
  expect(link.startsWith("sms:")).toBe(true);
  expect(link).toContain(encodeURIComponent("+15551234567"));
  expect(link).toContain("body=");
});

test("sms link without phone produces sms:?body=…", () => {
  const link = shareUrl("sms", base);
  expect(link.startsWith("sms:?body=")).toBe(true);
});

test("email mailto link carries subject + body, optional to/cc/bcc", () => {
  const link = shareUrl("email", {
    ...base,
    to: "alice@example.com",
    cc: ["bob@example.com", "carol@example.com"],
  });
  expect(link.startsWith("mailto:alice%40example.com?")).toBe(true);
  expect(link).toContain("subject=");
  expect(link).toContain("body=");
  expect(link).toContain("cc=bob%40example.com%2Ccarol%40example.com");
});

test("shareUrl throws on unknown channel", () => {
  // @ts-expect-error: testing runtime guard
  expect(() => shareUrl("nope", base)).toThrow(/Unknown share channel/);
});

test("shareUrl throws on missing url", () => {
  // @ts-expect-error: testing runtime guard
  expect(() => shareUrl("twitter", { title: "x" })).toThrow(/url/);
});

test("share() returns a URL per built-in channel", () => {
  const out = share(base);
  for (const c of channels) {
    expect(out[c]).toBeTruthy();
    expect(typeof out[c]).toBe("string");
  }
});

test("listChannels returns ordered list with labels", () => {
  const all = listChannels();
  expect(all).toHaveLength(channels.length);
  expect(all[0]?.channel).toBe("twitter");
  expect(all[0]?.label).toBe("X (Twitter)");
});
