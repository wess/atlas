import { expect, test } from "bun:test";
import { decideInline } from "../inline";

test("inline-allowed mime stays inline", () => {
  const d = decideInline("image/png", "cat.png", true);
  expect(d.contentType).toBe("image/png");
  expect(d.disposition).toBe('inline; filename="cat.png"');
});

test("PDF is allowed inline", () => {
  const d = decideInline("application/pdf", "report.pdf", true);
  expect(d.contentType).toBe("application/pdf");
  expect(d.disposition.startsWith("inline")).toBe(true);
});

test("text/plain is allowed inline", () => {
  const d = decideInline("text/plain", "notes.txt", true);
  expect(d.contentType).toBe("text/plain");
});

test("video and audio prefixes are allowed inline", () => {
  expect(decideInline("video/mp4", "x.mp4", true).disposition.startsWith("inline")).toBe(true);
  expect(decideInline("audio/mpeg", "x.mp3", true).disposition.startsWith("inline")).toBe(true);
});

test("SVG is forced to attachment even if requested inline", () => {
  const d = decideInline("image/svg+xml", "logo.svg", true);
  expect(d.contentType).toBe("application/octet-stream");
  expect(d.disposition.startsWith("attachment")).toBe(true);
});

test("HTML is forced to attachment", () => {
  const d = decideInline("text/html", "evil.html", true);
  expect(d.contentType).toBe("application/octet-stream");
  expect(d.disposition.startsWith("attachment")).toBe(true);
});

test("attachment is forced when wantInline is false even for safe MIMEs", () => {
  const d = decideInline("image/png", "cat.png", false);
  expect(d.contentType).toBe("application/octet-stream");
  expect(d.disposition.startsWith("attachment")).toBe(true);
});

test("filename is URL-encoded", () => {
  const d = decideInline("image/png", "spaces and ünicode.png", true);
  expect(d.disposition).toContain("spaces%20and%20%C3%BCnicode.png");
});

test("MIME parameters are stripped before allowlist check", () => {
  const d = decideInline("text/plain; charset=utf-8", "notes.txt", true);
  expect(d.disposition.startsWith("inline")).toBe(true);
});
