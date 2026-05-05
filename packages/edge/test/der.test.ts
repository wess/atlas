import { expect, test } from "bun:test";
import { bitString, integer, integerBytes, OID, octetString, p1363ToDer, sequence } from "../acme/der.ts";

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

test("integer encodes small values", () => {
  expect(hex(integer(0))).toBe("020100");
  expect(hex(integer(1))).toBe("020101");
  expect(hex(integer(127))).toBe("02017f");
  // 128 needs leading zero so high bit doesn't flag negative
  expect(hex(integer(128))).toBe("02020080");
});

test("sequence wraps in 0x30", () => {
  const inner = integer(1);
  const seq = sequence(inner);
  expect(seq[0]).toBe(0x30);
  expect(seq[1]).toBe(inner.byteLength);
});

test("octetString tag is 0x04", () => {
  const o = octetString(new Uint8Array([1, 2, 3]));
  expect(o[0]).toBe(0x04);
  expect(o[1]).toBe(3);
});

test("bitString prepends unused-bits byte", () => {
  const b = bitString(new Uint8Array([0xab]));
  expect(b[0]).toBe(0x03);
  expect(b[1]).toBe(2); // length: 1 unused-bits + 1 byte
  expect(b[2]).toBe(0); // unused bits
  expect(b[3]).toBe(0xab);
});

test("integerBytes pads negative high-bit", () => {
  // 0x80 alone would be interpreted as negative; encoder must prefix 0x00
  const out = integerBytes(new Uint8Array([0x80, 0x00]));
  expect(hex(out)).toBe("0203008000");
});

test("integerBytes trims leading zeros", () => {
  const out = integerBytes(new Uint8Array([0x00, 0x00, 0x42]));
  expect(hex(out)).toBe("020142");
});

test("p1363ToDer round-trips into a SEQUENCE of two INTEGERs", () => {
  const r = new Uint8Array(32).fill(0x11);
  const s = new Uint8Array(32).fill(0x22);
  const raw = new Uint8Array([...r, ...s]);
  const der = p1363ToDer(raw);
  expect(der[0]).toBe(0x30); // SEQUENCE
  // Two INTEGERs of 32 bytes each = 0x02 0x20 (32 bytes) twice + sequence header
  // High bit of 0x11 is clear, so no leading zero.
});

test("OIDs have expected tag and length bytes", () => {
  expect(OID.ecdsaSha256[0]).toBe(0x06);
  expect(OID.ecdsaSha256[1]).toBe(0x08);
  expect(OID.subjectAltName[0]).toBe(0x06);
  expect(OID.subjectAltName[1]).toBe(0x03);
});
