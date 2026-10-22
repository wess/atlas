import { mkdir, open, rename, unlink } from "node:fs/promises";
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
  const safeKey = (key: string): string => {
    if (!key || key === "." || key === ".." || /[/\\\0]/.test(key)) throw new Error("Invalid certificate key");
    return key;
  };
  const certPath = (key: string) => join(root, "certs", safeKey(key), "cert.pem");
  const keyPath = (key: string) => join(root, "certs", safeKey(key), "key.pem");
  const metaPath = (key: string) => join(root, "certs", safeKey(key), "meta.json");
  const accountPath = join(root, "account.json");

  const ensureDir = async (path: string) => {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  };

  const writePrivate = async (path: string, value: string): Promise<void> => {
    const tmp = `${path}.${crypto.randomUUID()}.tmp`;
    const file = await open(tmp, "wx", 0o600);
    try {
      await Bun.write(Bun.file(file.fd), value);
      await file.sync();
      await file.close();
      await rename(tmp, path);
    } finally {
      await file.close();
      await unlink(tmp).catch(() => {});
    }
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
      await writePrivate(certPath(key), record.certPem);
      await writePrivate(keyPath(key), record.keyPem);
      await writePrivate(
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
      await writePrivate(accountPath, JSON.stringify(jwk));
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
