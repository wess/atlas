import { LETSENCRYPT_PROD, LETSENCRYPT_STAGING, defineEdge, proxy } from "@atlas/edge";
import { config, isProd, upstreamUrl } from "./src/config.ts";

defineEdge({
  // ACME runs only when ADMIN_EMAIL is set. In dev (no email), the edge falls
  // back to plain HTTP and runEdge auto-detects localhost — no certs, no sudo.
  acme: isProd
    ? {
        email: config.email,
        storage: config.storage,
        directoryUrl: config.staging ? LETSENCRYPT_STAGING : LETSENCRYPT_PROD,
      }
    : undefined,
  // In dev: pick a non-privileged port. In prod: leave defaults (80 + 443).
  ...(isProd ? {} : { httpPort: config.edgePort }),
  sites: [
    {
      host: config.domain,
      compress: ["gzip", "zstd"],
      routes: [{ handler: proxy(upstreamUrl) }],
    },
  ],
}).listen();
