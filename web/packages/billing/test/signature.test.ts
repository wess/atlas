import { expect, test } from "bun:test";
import { verifySignature } from "../index.ts";
import { signature } from "./fixture.ts";

test("verifies the raw body and every rotation signature", async () => {
  const body = '{"id":"evt_one"}';
  const signed = await signature(body);
  expect(await verifySignature(body, signed, "whsec_test")).toBe(true);
  expect(await verifySignature(body, `${signed},v1=${"0".repeat(64)}`, "whsec_test")).toBe(true);
  expect(await verifySignature(body, signed.replace(",", `,v1=${"0".repeat(64)},`), "whsec_test")).toBe(true);
  expect(await verifySignature(`${body} `, signed, "whsec_test")).toBe(false);
  expect(await verifySignature(body, signed, "wrong")).toBe(false);
});

test("rejects stale, future, malformed, or missing signature fields", async () => {
  const body = "{}";
  const now = Math.floor(Date.now() / 1000);
  for (const header of [
    "",
    "t=NaN,v1=bad",
    "t=1",
    `t=${now},v1=bad`,
    await signature(body, String(now - 301)),
    await signature(body, String(now + 301)),
    `${await signature(body)},t=${now}`,
  ]) {
    expect(await verifySignature(body, header, "whsec_test", { now })).toBe(false);
  }
  expect(await verifySignature(body, await signature(body), "")).toBe(false);
  expect(await verifySignature(body, await signature(body), "whsec_test", { tolerance: 0 })).toBe(false);
});

test("preserves the original signed timestamp string", async () => {
  const header = await signature("{}", `0${Math.floor(Date.now() / 1000)}`);
  expect(await verifySignature("{}", header, "whsec_test")).toBe(true);
});
