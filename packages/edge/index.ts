// Top-level entry for @atlas/edge.

export type { ChallengeHook, ProvisionOptions, ProvisionResult } from "./acme/index.ts";
export {
  generateKeyPair,
  importKeyPair,
  jwkThumbprint,
  LETSENCRYPT_PROD,
  LETSENCRYPT_STAGING,
  provisionCertificate,
} from "./acme/index.ts";
export type { CertRecord, CertStore, RenewalScheduler } from "./certs/index.ts";
export {
  certKey,
  createRenewalScheduler,
  fileStore,
  issueCert,
  memoryStore,
  renewAt,
} from "./certs/index.ts";
export type { Encoding } from "./compress/index.ts";
export { compressResponse } from "./compress/index.ts";
export type { FilesOptions } from "./files/index.ts";
export { files } from "./files/index.ts";
export type { RouteMatcher } from "./match/index.ts";
export { isLocalHost, matchHost, matchRoute } from "./match/index.ts";
export type { ForwardContext, ProxyOptions } from "./proxy/index.ts";
export { forward, proxy } from "./proxy/index.ts";
export type {
  AcmeConfig,
  EdgeConfig,
  EdgeHandler,
  Route,
  RunningEdge,
  Site,
} from "./site/index.ts";
export { runEdge } from "./site/index.ts";

import type { EdgeConfig, RunningEdge } from "./site/index.ts";
import { runEdge } from "./site/index.ts";

export const defineEdge = (config: EdgeConfig) => ({
  ...config,
  listen: (): Promise<RunningEdge> => runEdge(config),
});
