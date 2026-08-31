import { expect, test } from "bun:test";
import { createRenewalScheduler, renewAt } from "../certs/renewal.ts";
import type { CertRecord } from "../certs/store.ts";

const day = 24 * 60 * 60 * 1000;

const record = (issuedAt: number, notAfter: number): CertRecord => ({
  hosts: ["example.com"],
  certPem: "",
  keyPem: "",
  issuedAt,
  notAfter,
});

test("renewAt fires 30 days before expiry", () => {
  const now = Date.now();
  const r = record(now - 60 * day, now + 30 * day);
  // notAfter - 30d == now exactly; clamped to at least now + 1min
  const at = renewAt(r);
  expect(at).toBeGreaterThanOrEqual(now);
});

test("renewAt clamps to a minimum delay when cert is already near expiry", () => {
  const now = Date.now();
  // Cert expires tomorrow — we should still schedule, not in the past
  const r = record(now - 89 * day, now + 1 * day);
  const at = renewAt(r);
  expect(at).toBeGreaterThan(now);
});

test("scheduler.cancel removes a pending renewal", async () => {
  let called = 0;
  const sched = createRenewalScheduler(async () => {
    called++;
  });
  const r = record(Date.now() - 89 * day, Date.now() + day);
  sched.schedule("k", r);
  sched.cancel("k");
  await new Promise((r) => setTimeout(r, 50));
  expect(called).toBe(0);
  sched.stop();
});
