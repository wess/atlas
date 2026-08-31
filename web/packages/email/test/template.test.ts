import { expect, test } from "bun:test";
import { escapeHtml, inviteEmail, layout, passwordResetEmail } from "../template";

test("escapeHtml escapes the standard set of unsafe characters", () => {
  expect(escapeHtml('<a href="x">y & z</a>')).toBe("&lt;a href=&quot;x&quot;&gt;y &amp; z&lt;/a&gt;");
});

test("layout renders a doctype + the body", () => {
  const html = layout({ title: "Hi", body: "<p>Hello</p>" });
  expect(html.startsWith("<!doctype html>")).toBe(true);
  expect(html).toContain("<title>Hi</title>");
  expect(html).toContain("<p>Hello</p>");
});

test("layout escapes the title", () => {
  const html = layout({ title: "<script>alert(1)</script>", body: "<p>ok</p>" });
  expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(html).not.toContain("<script>alert(1)</script>");
});

test("layout includes brand and footer when supplied", () => {
  const html = layout({ title: "Hi", body: "<p>x</p>", brand: "Atlas", footer: "Atlas · self-hostable" });
  expect(html).toContain('class="brand">Atlas</p>');
  expect(html).toContain('class="footer">Atlas · self-hostable</div>');
});

test("layout omits brand and footer when absent", () => {
  const html = layout({ title: "Hi", body: "<p>x</p>" });
  expect(html).not.toContain('class="brand"');
  expect(html).not.toContain('class="footer"');
});

test("layout uses a custom accent color", () => {
  const html = layout({ title: "Hi", body: "<p>x</p>", accent: "#ff8800" });
  expect(html).toContain("background: #ff8800");
});

test("inviteEmail composes subject, html, and text", () => {
  const email = inviteEmail({
    inviterName: "Wess",
    product: "Atlas",
    signupUrl: "https://example.com/signup?invite=abc",
  });
  expect(email.subject).toBe("Wess invited you to Atlas");
  expect(email.html).toContain("Wess</strong>");
  expect(email.html).toContain("https://example.com/signup?invite=abc");
  expect(email.text).toContain("Wess invited you to join Atlas");
  expect(email.text).toContain("https://example.com/signup?invite=abc");
});

test("inviteEmail falls back to 'Someone' when inviterName is missing", () => {
  const a = inviteEmail({ product: "Atlas", signupUrl: "https://x" });
  const b = inviteEmail({ inviterName: "  ", product: "Atlas", signupUrl: "https://x" });
  expect(a.subject).toBe("Someone invited you to Atlas");
  expect(b.subject).toBe("Someone invited you to Atlas");
});

test("inviteEmail renders the optional note as a quote", () => {
  const email = inviteEmail({
    product: "Atlas",
    signupUrl: "https://x",
    note: "Excited to have you",
  });
  expect(email.html).toContain("<blockquote");
  expect(email.html).toContain("Excited to have you");
  expect(email.text).toContain("Their note:");
});

test("inviteEmail escapes user-supplied strings in HTML", () => {
  const email = inviteEmail({
    inviterName: "<script>alert(1)</script>",
    product: "Atlas & friends",
    signupUrl: "https://x",
    note: "<img src=x onerror=alert(1)>",
  });
  expect(email.html).not.toContain("<script>alert(1)</script>");
  expect(email.html).not.toContain("<img src=x onerror=alert(1)>");
  expect(email.html).toContain("&lt;script&gt;");
  expect(email.html).toContain("Atlas &amp; friends");
});

test("passwordResetEmail mentions the product and the expiry", () => {
  const email = passwordResetEmail({
    product: "Atlas",
    resetUrl: "https://example.com/reset?token=abc",
    expiresInMinutes: 30,
  });
  expect(email.subject).toBe("Reset your Atlas password");
  expect(email.html).toContain("https://example.com/reset?token=abc");
  expect(email.html).toContain("This link expires in 30 minutes");
  expect(email.text).toContain("This link expires in 30 minutes");
});

test("passwordResetEmail defaults to 60-minute expiry", () => {
  const email = passwordResetEmail({ product: "Atlas", resetUrl: "https://x" });
  expect(email.html).toContain("This link expires in 60 minutes");
});
