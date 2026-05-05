import type { Encoding } from "../compress/index.ts";
import type { RouteMatcher } from "../match/index.ts";
import type { ForwardContext } from "../proxy/index.ts";

export type EdgeHandler = (req: Request, ctx: ForwardContext) => Promise<Response>;

export type Route = {
  readonly match?: RouteMatcher;
  readonly handler: EdgeHandler;
};

export type Site = {
  readonly host: string;
  readonly routes: ReadonlyArray<Route>;
  readonly compress?: ReadonlyArray<Encoding>;
};

export type AcmeConfig = {
  readonly email: string;
  readonly directoryUrl?: string;
  readonly storage: string | { readonly directory: string };
};

export type EdgeConfig = {
  readonly acme?: AcmeConfig;
  readonly sites: ReadonlyArray<Site>;
  // Override: skip TLS even for non-localhost. Useful for tests.
  readonly insecure?: boolean;
  readonly httpPort?: number;
  readonly httpsPort?: number;
};
