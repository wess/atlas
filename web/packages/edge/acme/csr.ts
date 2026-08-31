import {
  bitString,
  contextConstructed,
  contextPrimitive,
  integer,
  OID,
  octetString,
  p1363ToDer,
  sequence,
  set,
} from "./der.ts";

const dnsName = (host: string): Uint8Array => contextPrimitive(2, new TextEncoder().encode(host));

const subjectAltNameExtension = (hosts: ReadonlyArray<string>): Uint8Array => {
  const sanValue = sequence(...hosts.map(dnsName));
  return sequence(OID.subjectAltName, octetString(sanValue));
};

const extensionRequestAttribute = (hosts: ReadonlyArray<string>): Uint8Array =>
  sequence(OID.extensionRequest, set(sequence(subjectAltNameExtension(hosts))));

const ecdsaSha256Algorithm = sequence(OID.ecdsaSha256);

export const buildCsr = async (hosts: ReadonlyArray<string>, certKey: CryptoKeyPair): Promise<Uint8Array> => {
  if (hosts.length === 0) throw new Error("CSR requires at least one host");

  const spkiBuf = await crypto.subtle.exportKey("spki", certKey.publicKey);
  const spki = new Uint8Array(spkiBuf);

  const cri = sequence(
    integer(0), // version
    sequence(), // empty subject — CA uses SANs
    spki,
    contextConstructed(0, extensionRequestAttribute(hosts)),
  );

  const sigRaw = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      certKey.privateKey,
      new Uint8Array(cri).buffer as ArrayBuffer,
    ),
  );
  const sigDer = p1363ToDer(sigRaw);

  return sequence(cri, ecdsaSha256Algorithm, bitString(sigDer));
};
