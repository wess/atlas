import type { ChallengeHook } from "../acme/client.ts";
import { provisionCertificate } from "../acme/client.ts";
import type { AcmeKeyPair } from "../acme/keys.ts";
import { exportJwkFull, generateKeyPair, importKeyPair } from "../acme/keys.ts";
import type { CertRecord, CertStore } from "./store.ts";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export type IssueParams = {
  readonly directoryUrl: string;
  readonly contactEmail: string;
  readonly hosts: ReadonlyArray<string>;
  readonly store: CertStore;
  readonly challenge: ChallengeHook;
};

export const loadOrCreateAccount = async (store: CertStore): Promise<AcmeKeyPair> => {
  const existing = await store.loadAccountJwk();
  if (existing) return importKeyPair(existing);
  const fresh = await generateKeyPair();
  const jwk = await exportJwkFull(fresh.privateKey);
  await store.saveAccountJwk(jwk);
  return fresh;
};

export const issueCert = async (params: IssueParams): Promise<CertRecord> => {
  const account = await loadOrCreateAccount(params.store);
  const result = await provisionCertificate({
    directoryUrl: params.directoryUrl,
    accountKey: account,
    contactEmail: params.contactEmail,
    hosts: params.hosts,
    challenge: params.challenge,
  });
  const issuedAt = Date.now();
  return {
    hosts: params.hosts,
    certPem: result.certPem,
    keyPem: result.keyPem,
    issuedAt,
    notAfter: issuedAt + NINETY_DAYS_MS,
  };
};
