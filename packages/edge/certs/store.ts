import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Jwk } from "../acme/keys.ts";

export type CertRecord = {
  readonly hosts: ReadonlyArray<string>;
  readonly certPem: string;
  readonly keyPem: string;
  readonly issuedAt: number;
  readonly notAfter: number;
};

export type CertStore = {
  readonly load: (key: string) => Promise<CertRecord | null>;
  readonly save: (key: string, record: CertRecord) => Promise<void>;
  readonly loadAccountJwk: () => Promise<Jwk | null>;
  readonly saveAccountJwk: (jwk: Jwk) => Promise<void>;
};

export const fileStore = (root: string): CertStore => {
  const certPath = (key: string) => join(root, "certs", key, "cert.pem");
  const keyPath = (key: string) => join(root, "certs", key, "key.pem");
  const metaPath = (key: string) => join(root, "certs", key, "meta.json");
  const accountPath = join(root, "account.json");

  const ensureDir = async (path: string) => {
    await mkdir(dirname(path), { recursive: true });
  };

  return {
    load: async (key) => {
      const meta = Bun.file(metaPath(key));
      if (!(await meta.exists())) return null;
      const cert = Bun.file(certPath(key));
      const k = Bun.file(keyPath(key));
      if (!(await cert.exists()) || !(await k.exists())) return null;
      const m = (await meta.json()) as { hosts: string[]; issuedAt: number; notAfter: number };
      return {
        hosts: m.hosts,
        certPem: await cert.text(),
        keyPem: await k.text(),
        issuedAt: m.issuedAt,
        notAfter: m.notAfter,
      };
    },
    save: async (key, record) => {
      await ensureDir(certPath(key));
      await Bun.write(certPath(key), record.certPem);
      await Bun.write(keyPath(key), record.keyPem);
      await Bun.write(
        metaPath(key),
        JSON.stringify({
          hosts: record.hosts,
          issuedAt: record.issuedAt,
          notAfter: record.notAfter,
        }),
      );
    },
    loadAccountJwk: async () => {
      const f = Bun.file(accountPath);
      if (!(await f.exists())) return null;
      return (await f.json()) as Jwk;
    },
    saveAccountJwk: async (jwk) => {
      await ensureDir(accountPath);
      await Bun.write(accountPath, JSON.stringify(jwk));
    },
  };
};

export const memoryStore = (): CertStore => {
  const certs = new Map<string, CertRecord>();
  let account: Jwk | null = null;
  return {
    load: async (key) => certs.get(key) ?? null,
    save: async (key, record) => {
      certs.set(key, record);
    },
    loadAccountJwk: async () => account,
    saveAccountJwk: async (jwk) => {
      account = jwk;
    },
  };
};

// Stable cache key for a list of hosts.
export const certKey = (hosts: ReadonlyArray<string>): string => [...hosts].sort().join(",");
