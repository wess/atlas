import { defineConfig, env } from "@atlas/config";

// One config, two modes:
//   - dev:  DOMAIN unset → edge runs plain HTTP on EDGE_PORT (default 8080)
//   - prod: DOMAIN + ADMIN_EMAIL set → edge runs ACME + TLS on :80 + :443
export const config = defineConfig({
  domain: env("DOMAIN", { default: "localhost" }),
  email: env("ADMIN_EMAIL", { default: "" }),
  appPort: env("APP_PORT", { parse: Number, default: "3000" }),
  appUrl: env("APP_URL", { default: "" }),
  storage: env("CERT_DIR", { default: "./.certs" }),
  staging: env("ACME_STAGING", { default: "" }),
  edgePort: env("EDGE_PORT", { parse: Number, default: "8080" }),
});

export const upstreamUrl = config.appUrl || `http://localhost:${config.appPort}`;
export const isProd = Boolean(config.email) && config.domain !== "localhost";
