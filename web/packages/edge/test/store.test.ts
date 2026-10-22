import { expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileStore } from "../certs/store.ts";

test("private certificate/account files are owner-only and keys cannot traverse directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlascerts"));
  const store = fileStore(root);
  const record = { hosts: ["example.test"], certPem: "cert", keyPem: "private", issuedAt: 1, notAfter: 2 };
  try {
    await store.save("example.test", record);
    await store.saveAccountJwk({ kty: "RSA" });
    expect(await store.load("example.test")).toEqual(record);
    expect(await store.loadAccountJwk()).toEqual({ kty: "RSA" });
    if (process.platform !== "win32") {
      expect((await stat(join(root, "certs/example.test/key.pem"))).mode & 0o777).toBe(0o600);
      expect((await stat(join(root, "account.json"))).mode & 0o777).toBe(0o600);
    }
    await expect(store.save("../outside", record)).rejects.toThrow("Invalid certificate key");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
