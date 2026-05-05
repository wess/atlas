export type AcmeDirectory = {
  readonly newNonce: string;
  readonly newAccount: string;
  readonly newOrder: string;
  readonly revokeCert: string;
  readonly keyChange: string;
};

export const LETSENCRYPT_PROD = "https://acme-v02.api.letsencrypt.org/directory";
export const LETSENCRYPT_STAGING = "https://acme-staging-v02.api.letsencrypt.org/directory";

export const fetchDirectory = async (url: string): Promise<AcmeDirectory> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`acme: directory fetch failed ${res.status}`);
  const body = (await res.json()) as Record<string, string>;
  const required = ["newNonce", "newAccount", "newOrder"] as const;
  for (const k of required) {
    if (typeof body[k] !== "string") throw new Error(`acme: directory missing ${k}`);
  }
  return {
    newNonce: body.newNonce!,
    newAccount: body.newAccount!,
    newOrder: body.newOrder!,
    revokeCert: body.revokeCert ?? "",
    keyChange: body.keyChange ?? "",
  };
};
