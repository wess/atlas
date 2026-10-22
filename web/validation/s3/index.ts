import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Catalog } from "../../distribution/build.ts";
import { signRequest } from "../../packages/storage/signing/index.ts";

export async function validateS3(binary: string, artifacts: string): Promise<void> {
  binary = resolve(binary);
  artifacts = resolve(artifacts);
  const root = await mkdtemp(join(tmpdir(), "atlass3"));
  const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response(null) });
  const endpoint = probe.url.origin;
  const address = `127.0.0.1:${probe.port}`;
  await probe.stop(true);
  const accessKey = "atlasfixture";
  const secretKey = crypto.randomUUID() + crypto.randomUUID();
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    S3_TEST: "1",
    S3_ENDPOINT: endpoint,
    S3_BUCKET: "atlascheck",
    S3_ACCESS_KEY: accessKey,
    S3_SECRET_KEY: secretKey,
    S3_REGION: "us-east-1",
  };
  await mkdir(join(root, "data"));
  const server = Bun.spawn([binary, "server", "--address", address, join(root, "data")], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PATH: env.PATH,
      HOME: env.HOME,
      TMPDIR: env.TMPDIR,
      RUSTFS_ACCESS_KEY: accessKey,
      RUSTFS_SECRET_KEY: secretKey,
    },
  });
  const stdout = new Response(server.stdout).text();
  const stderr = new Response(server.stderr).text();
  let child: ReturnType<typeof Bun.spawn> | undefined;
  const stop = () => {
    child?.kill("SIGTERM");
    server.kill("SIGTERM");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const run = async (args: string[], cwd: string, log: string): Promise<void> => {
    const active = Bun.spawn([process.execPath, "--no-env-file", ...args], {
      cwd,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });
    child = active;
    const [code, output, errors] = await Promise.all([
      active.exited,
      new Response(active.stdout).text(),
      new Response(active.stderr).text(),
    ]);
    await Bun.write(log, output + errors);
    child = undefined;
    if (code !== 0) throw new Error(`S3 check failed: ${log}`);
  };
  try {
    let ready = false;
    const url = new URL("/atlascheck", endpoint);
    for (let attempt = 0; attempt < 300; attempt++) {
      if (server.exitCode !== null) throw new Error("RustFS exited during startup");
      try {
        const headers = new Headers({ host: url.host });
        const signed = signRequest({ method: "PUT", url, headers, accessKey, secretKey });
        headers.set("authorization", signed.authorization);
        const response = await fetch(url, { method: "PUT", headers, signal: AbortSignal.timeout(1000) });
        if (response.ok) {
          ready = true;
          break;
        }
        if (response.status !== 503)
          throw new Error(`Bucket creation returned ${response.status}: ${await response.text()}`);
      } catch (error) {
        if (attempt === 299) throw error;
      }
      await Bun.sleep(100);
    }
    if (!ready) throw new Error("RustFS did not become ready");
    const unauthenticated = await fetch(new URL("/atlascheck/private", endpoint));
    if (unauthenticated.status !== 403) throw new Error("S3 fixture unexpectedly permits anonymous object access");
    const invalidUrl = new URL("/atlascheck/private", endpoint);
    const invalidHeaders = new Headers({ host: invalidUrl.host });
    const invalid = signRequest({
      method: "GET",
      url: invalidUrl,
      headers: invalidHeaders,
      accessKey,
      secretKey: "invalid-fixture-secret",
    });
    invalidHeaders.set("authorization", invalid.authorization);
    if ((await fetch(invalidUrl, { headers: invalidHeaders })).status !== 403) {
      throw new Error("S3 fixture unexpectedly accepts an invalid signature");
    }
    const web = resolve(import.meta.dir, "../..");
    await run(["test", "packages/storage/"], web, "/tmp/atlass3source.log");
    const consumer = join(root, "consumer");
    const catalog: Catalog = await Bun.file(join(artifacts, "catalog.json")).json();
    await Bun.write(
      join(consumer, "package.json"),
      JSON.stringify({
        name: "s3fixture",
        type: "module",
        dependencies: {
          "@wess/atlas": join(artifacts, catalog.packages["@wess/atlas"]!.tarball!),
          "@wess/atlas-storage": join(artifacts, catalog.packages["@wess/atlas-storage"]!.tarball!),
        },
      }),
    );
    await run(["install", "--ignore-scripts", "--registry", "http://127.0.0.1:1"], consumer, "/tmp/atlass3install.log");
    await Bun.write(join(consumer, "transfer.ts"), Bun.file(join(import.meta.dir, "transfer.ts")));
    await run(["run", "transfer.ts"], consumer, "/tmp/atlass3packed.log");
    console.log("S3 source integration and packed transfer checks passed");
  } finally {
    stop();
    await server.exited;
    await Bun.write("/tmp/atlass3server.log", (await stdout) + (await stderr));
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await rm(root, { recursive: true, force: true });
  }
}

if (import.meta.main) await validateS3(Bun.argv[2] ?? "rustfs", Bun.argv[3] ?? "out/distribution");
