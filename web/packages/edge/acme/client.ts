import { b64url } from "./base64.ts";
import { buildCsr } from "./csr.ts";
import type { AcmeDirectory } from "./directory.ts";
import { fetchDirectory } from "./directory.ts";
import { signJws } from "./jws.ts";
import type { AcmeKeyPair } from "./keys.ts";
import { jwkThumbprint } from "./keys.ts";

const JOSE_CONTENT_TYPE = "application/jose+json";

type Session = {
  readonly directory: AcmeDirectory;
  readonly account: AcmeKeyPair;
  readonly kid: string;
  readonly thumbprint: string;
  nonce: string;
};

export type ChallengeHook = {
  readonly set: (token: string, keyAuth: string) => void | Promise<void>;
  readonly clear: (token: string) => void | Promise<void>;
};

export type ProvisionOptions = {
  readonly directoryUrl: string;
  readonly accountKey: AcmeKeyPair;
  readonly contactEmail: string;
  readonly hosts: ReadonlyArray<string>;
  readonly challenge: ChallengeHook;
  readonly pollIntervalMs?: number;
  readonly pollTimeoutMs?: number;
};

export type ProvisionResult = {
  readonly certPem: string;
  readonly keyPem: string;
};

const newNonce = async (directoryUrl: string, dir: AcmeDirectory): Promise<string> => {
  const res = await fetch(dir.newNonce, { method: "HEAD" });
  const n = res.headers.get("replay-nonce");
  if (!n) throw new Error(`acme: no Replay-Nonce from ${directoryUrl}`);
  return n;
};

const consumeNonce = (session: Session, res: Response): void => {
  const fresh = res.headers.get("replay-nonce");
  if (fresh) session.nonce = fresh;
};

const signedPost = async (session: Session, url: string, payload: unknown, useJwk = false): Promise<Response> => {
  const header = useJwk
    ? ({ alg: "ES256", nonce: session.nonce, url, jwk: session.account.jwk } as const)
    : ({ alg: "ES256", nonce: session.nonce, url, kid: session.kid } as const);
  const body = await signJws(session.account.privateKey, header, payload);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": JOSE_CONTENT_TYPE },
    body: JSON.stringify(body),
  });
  consumeNonce(session, res);
  return res;
};

const readJson = async <T>(res: Response, ctx: string): Promise<T> => {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`acme: ${ctx} failed ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const pemEncode = (label: string, der: Uint8Array): string => {
  let bin = "";
  for (let i = 0; i < der.byteLength; i++) bin += String.fromCharCode(der[i]!);
  const b64 = btoa(bin);
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
};

type OrderResponse = {
  status: "pending" | "ready" | "processing" | "valid" | "invalid";
  authorizations: string[];
  finalize: string;
  certificate?: string;
};

type AuthzResponse = {
  status: "pending" | "valid" | "invalid" | "deactivated" | "expired" | "revoked";
  challenges: Array<{ type: string; url: string; token: string; status: string }>;
};

export const provisionCertificate = async (opts: ProvisionOptions): Promise<ProvisionResult> => {
  const directory = await fetchDirectory(opts.directoryUrl);
  const initialNonce = await newNonce(opts.directoryUrl, directory);
  const thumbprint = await jwkThumbprint(opts.accountKey.jwk);

  // Stage 1: register account (or recover existing) — POST with embedded JWK.
  const partial: Session = {
    directory,
    account: opts.accountKey,
    kid: "",
    thumbprint,
    nonce: initialNonce,
  };
  const acctRes = await signedPost(
    partial,
    directory.newAccount,
    { termsOfServiceAgreed: true, contact: [`mailto:${opts.contactEmail}`] },
    true,
  );
  if (acctRes.status !== 200 && acctRes.status !== 201) {
    const text = await acctRes.text();
    throw new Error(`acme: newAccount failed ${acctRes.status}: ${text}`);
  }
  const kid = acctRes.headers.get("location");
  if (!kid) throw new Error("acme: newAccount returned no Location");
  const session: Session = { directory, account: opts.accountKey, kid, thumbprint, nonce: partial.nonce };

  // Stage 2: new order.
  const orderRes = await signedPost(session, directory.newOrder, {
    identifiers: opts.hosts.map((h) => ({ type: "dns", value: h })),
  });
  const orderUrl = orderRes.headers.get("location");
  if (!orderUrl) throw new Error("acme: newOrder returned no Location");
  let order = await readJson<OrderResponse>(orderRes, "newOrder");

  // Stage 3: solve each authorization with HTTP-01.
  const tokens: string[] = [];
  for (const authzUrl of order.authorizations) {
    const authzRes = await signedPost(session, authzUrl, "");
    const authz = await readJson<AuthzResponse>(authzRes, "authz");
    if (authz.status === "valid") continue;
    const http01 = authz.challenges.find((c) => c.type === "http-01");
    if (!http01) throw new Error("acme: no http-01 challenge offered");
    const keyAuth = `${http01.token}.${session.thumbprint}`;
    await opts.challenge.set(http01.token, keyAuth);
    tokens.push(http01.token);
    const fired = await signedPost(session, http01.url, {});
    if (!fired.ok && fired.status !== 200) {
      const text = await fired.text();
      throw new Error(`acme: trigger challenge failed ${fired.status}: ${text}`);
    }
    await pollAuthz(session, authzUrl, opts.pollIntervalMs ?? 2000, opts.pollTimeoutMs ?? 120_000);
  }

  // Stage 4: finalize with CSR.
  const certKey = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const csr = await buildCsr(opts.hosts, certKey);
  const finalizeRes = await signedPost(session, order.finalize, { csr: b64url(csr) });
  order = await readJson<OrderResponse>(finalizeRes, "finalize");

  // Stage 5: poll order until valid.
  const deadline = Date.now() + (opts.pollTimeoutMs ?? 120_000);
  while (order.status !== "valid") {
    if (order.status === "invalid") throw new Error("acme: order became invalid");
    if (Date.now() > deadline) throw new Error("acme: order poll timeout");
    await sleep(opts.pollIntervalMs ?? 2000);
    const res = await signedPost(session, orderUrl, "");
    order = await readJson<OrderResponse>(res, "order poll");
  }
  if (!order.certificate) throw new Error("acme: order valid but no certificate URL");

  // Stage 6: download certificate chain.
  const certRes = await signedPost(session, order.certificate, "");
  if (!certRes.ok) {
    const text = await certRes.text();
    throw new Error(`acme: cert download failed ${certRes.status}: ${text}`);
  }
  const certPem = await certRes.text();

  // Cleanup tokens.
  for (const t of tokens) await opts.challenge.clear(t);

  // Export private key as PKCS#8 PEM.
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", certKey.privateKey);
  const keyPem = pemEncode("PRIVATE KEY", new Uint8Array(pkcs8));

  return { certPem, keyPem };
};

const pollAuthz = async (session: Session, authzUrl: string, intervalMs: number, timeoutMs: number): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (Date.now() > deadline) throw new Error("acme: authz poll timeout");
    await sleep(intervalMs);
    const res = await signedPost(session, authzUrl, "");
    const authz = await readJson<AuthzResponse>(res, "authz poll");
    if (authz.status === "valid") return;
    if (authz.status === "invalid") throw new Error("acme: authorization invalid");
  }
};
