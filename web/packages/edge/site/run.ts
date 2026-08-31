import { LETSENCRYPT_PROD } from "../acme/directory.ts";
import { issueCert } from "../certs/issue.ts";
import { createRenewalScheduler } from "../certs/renewal.ts";
import type { CertRecord, CertStore } from "../certs/store.ts";
import { certKey, fileStore } from "../certs/store.ts";
import { isLocalHost } from "../match/index.ts";
import type { ForwardContext } from "../proxy/index.ts";
import { createChallengeStore } from "./challenge.ts";
import { dispatch } from "./dispatch.ts";
import type { EdgeConfig, Site } from "./types.ts";

export type RunningEdge = {
  readonly stop: () => Promise<void>;
  readonly mode: "tls" | "plain";
};

type AnyServer = ReturnType<typeof Bun.serve>;

const remoteIpOf = (server: AnyServer, req: Request): string => {
  const addr = server.requestIP(req);
  return addr?.address ?? "0.0.0.0";
};

const hostOf = (req: Request): string => {
  const fromUrl = new URL(req.url).host;
  return req.headers.get("host") ?? fromUrl;
};

const tlsArrayFromCerts = (certs: ReadonlyMap<string, CertRecord>) => {
  const out: Array<{ cert: string; key: string; serverName: string }> = [];
  for (const record of certs.values()) {
    for (const host of record.hosts) {
      out.push({ cert: record.certPem, key: record.keyPem, serverName: host });
    }
  }
  return out;
};

const allHostsAreLocal = (sites: ReadonlyArray<Site>): boolean => sites.every((s) => isLocalHost(s.host));

const runPlain = async (config: EdgeConfig): Promise<RunningEdge> => {
  const port = config.httpPort ?? 80;
  const sites = config.sites;
  const server = Bun.serve({
    port,
    hostname: "0.0.0.0",
    fetch(req) {
      const ctx: ForwardContext = {
        remoteIp: remoteIpOf(server, req),
        tls: false,
        host: hostOf(req),
      };
      return dispatch(req, ctx, sites);
    },
  });
  console.log(`[atlas:edge] listening on http://0.0.0.0:${server.port} (dev/plain)`);
  return {
    mode: "plain",
    stop: async () => {
      server.stop(true);
    },
  };
};

const runTls = async (config: EdgeConfig): Promise<RunningEdge> => {
  if (!config.acme) throw new Error("edge: acme config is required for TLS mode");
  const httpPort = config.httpPort ?? 80;
  const httpsPort = config.httpsPort ?? 443;
  const sites = config.sites;
  const challenge = createChallengeStore();

  const storeRoot = typeof config.acme.storage === "string" ? config.acme.storage : config.acme.storage.directory;
  const store: CertStore = fileStore(storeRoot);

  // :80 — ACME challenge handler + redirect to HTTPS.
  const httpServer = Bun.serve({
    port: httpPort,
    hostname: "0.0.0.0",
    fetch(req) {
      const url = new URL(req.url);
      const answer = challenge.answer(url.pathname);
      if (answer !== null) {
        return new Response(answer, {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        });
      }
      const host = hostOf(req).split(":")[0];
      const target = `https://${host}${url.pathname}${url.search}`;
      return new Response(null, { status: 308, headers: { location: target } });
    },
  });
  console.log(`[atlas:edge] http listener on :${httpServer.port} (challenges + redirects)`);

  // Provision (or load) certs per site.
  const directoryUrl = config.acme.directoryUrl ?? LETSENCRYPT_PROD;
  const certs = new Map<string, CertRecord>();
  for (const site of sites) {
    const hosts = [site.host];
    const key = certKey(hosts);
    const existing = await store.load(key);
    if (existing) {
      certs.set(key, existing);
      continue;
    }
    try {
      const record = await issueCert({
        directoryUrl,
        contactEmail: config.acme.email,
        hosts,
        store,
        challenge,
      });
      await store.save(key, record);
      certs.set(key, record);
      console.log(`[atlas:edge] issued cert for ${hosts.join(", ")}`);
    } catch (err) {
      console.error(`[atlas:edge] failed to issue cert for ${hosts.join(", ")}:`, err);
    }
  }

  if (certs.size === 0) {
    console.error("[atlas:edge] no certs available — refusing to start :443");
    return {
      mode: "plain",
      stop: async () => {
        httpServer.stop(true);
      },
    };
  }

  // :443 — TLS terminator dispatching to sites.
  const httpsServer = Bun.serve({
    port: httpsPort,
    hostname: "0.0.0.0",
    tls: tlsArrayFromCerts(certs),
    fetch(req) {
      const ctx: ForwardContext = {
        remoteIp: remoteIpOf(httpsServer, req),
        tls: true,
        host: hostOf(req),
      };
      return dispatch(req, ctx, sites);
    },
  });
  console.log(`[atlas:edge] https listener on :${httpsServer.port}`);

  // Renewal: reissue and hot-swap cert array.
  const renewals = createRenewalScheduler(async (key) => {
    const site = sites.find((s) => certKey([s.host]) === key);
    if (!site) return;
    const record = await issueCert({
      directoryUrl,
      contactEmail: config.acme!.email,
      hosts: [site.host],
      store,
      challenge,
    });
    await store.save(key, record);
    certs.set(key, record);
    httpsServer.reload({ tls: tlsArrayFromCerts(certs) } as Bun.ServeOptions);
    renewals.schedule(key, record);
    console.log(`[atlas:edge] renewed cert for ${site.host}`);
  });

  for (const [key, record] of certs) renewals.schedule(key, record);

  return {
    mode: "tls",
    stop: async () => {
      renewals.stop();
      httpServer.stop(true);
      httpsServer.stop(true);
    },
  };
};

export const runEdge = async (config: EdgeConfig): Promise<RunningEdge> => {
  if (config.insecure || allHostsAreLocal(config.sites)) return runPlain(config);
  return runTls(config);
};
