import { afterEach, expect, spyOn, test } from "bun:test";
import { passwordResetEmail } from "../template";
import { createConsoleEmailer, createEmailer } from "../transport";

const original = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = original;
});

const capture = () => {
  const lines: string[] = [];
  const log = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.join(" "));
  });
  const warn = spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    lines.push(`WARN ${args.join(" ")}`);
  });
  return {
    lines,
    restore: () => {
      log.mockRestore();
      warn.mockRestore();
    },
  };
};

test("production console fallback warns once and redacts reset links", async () => {
  process.env.NODE_ENV = "production";
  const out = capture();
  try {
    const token = "Zx9fQ2kLm8pR4tV7wY1bN3cD5eF6gH0j";
    const url = `https://app.example.com/reset?token=${token}`;
    const mail = passwordResetEmail({ product: "App", resetUrl: url });
    const a = createEmailer({ apiKey: null, from: null });
    createEmailer({ apiKey: null, from: null });
    await a.send({ to: "a@b.c", subject: mail.subject, html: mail.html, text: mail.text });
    const all = out.lines.join("\n");
    expect(all).not.toContain(token);
    expect(all).not.toContain("app.example.com/reset");
    expect(all).toContain("[url redacted]");
    expect(all).toContain("a@b.c");
    expect(out.lines.filter((l) => l.startsWith("WARN")).length).toBeLessThanOrEqual(1);
  } finally {
    out.restore();
  }
});

test("outside production the console emailer logs the full body", async () => {
  process.env.NODE_ENV = "development";
  const out = capture();
  try {
    await createConsoleEmailer().send({
      to: "a@b.c",
      subject: "s",
      html: "x",
      text: "https://app.example.com/reset?t=1",
    });
    expect(out.lines.join("\n")).toContain("https://app.example.com/reset?t=1");
  } finally {
    out.restore();
  }
});
