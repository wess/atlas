// Minimal DER encoder. Sufficient for building a PKCS#10 CSR and converting
// IEEE P1363 ECDSA signatures into ASN.1 SEQUENCE { r, s }.

const cat = (parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  let total = 0;
  for (const p of parts) total += p.byteLength;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return out;
};

const encodeLength = (len: number): Uint8Array => {
  if (len < 0x80) return new Uint8Array([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
};

export const tlv = (tag: number, content: Uint8Array): Uint8Array =>
  cat([new Uint8Array([tag]), encodeLength(content.byteLength), content]);

export const sequence = (...children: Uint8Array[]): Uint8Array => tlv(0x30, cat(children));
export const set = (...children: Uint8Array[]): Uint8Array => tlv(0x31, cat(children));
export const contextConstructed = (n: number, ...children: Uint8Array[]): Uint8Array => tlv(0xa0 | n, cat(children));
export const contextPrimitive = (n: number, content: Uint8Array): Uint8Array => tlv(0x80 | n, content);

export const integer = (value: number): Uint8Array => {
  if (value < 0) throw new Error("negative integers unsupported");
  const bytes: number[] = [];
  let n = value;
  do {
    bytes.unshift(n & 0xff);
    n >>>= 8;
  } while (n > 0);
  if (bytes[0]! & 0x80) bytes.unshift(0);
  return tlv(0x02, new Uint8Array(bytes));
};

// INTEGER from a raw big-endian magnitude (used for r, s in ECDSA signatures).
export const integerBytes = (mag: Uint8Array): Uint8Array => {
  let i = 0;
  while (i < mag.byteLength - 1 && mag[i] === 0) i++;
  const trimmed = mag.subarray(i);
  const needsLeading = (trimmed[0]! & 0x80) !== 0;
  const body = needsLeading ? cat([new Uint8Array([0]), trimmed]) : new Uint8Array(trimmed);
  return tlv(0x02, body);
};

export const bitString = (content: Uint8Array, unusedBits = 0): Uint8Array =>
  tlv(0x03, cat([new Uint8Array([unusedBits]), content]));

export const octetString = (content: Uint8Array): Uint8Array => tlv(0x04, content);
export const ia5String = (s: string): Uint8Array => tlv(0x16, new TextEncoder().encode(s));

// Pre-encoded OIDs (TLV form, ready to drop in).
export const OID = {
  // 1.2.840.10045.4.3.2 — ecdsa-with-SHA256
  ecdsaSha256: new Uint8Array([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02]),
  // 1.2.840.113549.1.9.14 — extensionRequest
  extensionRequest: new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x0e]),
  // 2.5.29.17 — subjectAltName
  subjectAltName: new Uint8Array([0x06, 0x03, 0x55, 0x1d, 0x11]),
} as const;

// Convert IEEE P1363 (r||s) signature to ASN.1 DER SEQUENCE { r INTEGER, s INTEGER }.
export const p1363ToDer = (raw: Uint8Array): Uint8Array => {
  const half = raw.byteLength / 2;
  const r = raw.subarray(0, half);
  const s = raw.subarray(half);
  return sequence(integerBytes(r), integerBytes(s));
};
