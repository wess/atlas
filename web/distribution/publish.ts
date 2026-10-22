import { join, resolve } from "node:path";
import { releaseUrl } from "../packages/cli/modules/source.ts";
import type { Catalog } from "./build.ts";

export const publishedIntegrity = async (name: string, version: string): Promise<string | undefined> => {
  const response = await fetch(releaseUrl(name, version), { signal: AbortSignal.timeout(30_000) });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`GitHub release lookup failed for ${name}@${version}: ${response.status}`);
  const digest = new Bun.CryptoHasher("sha512");
  if (!response.body) throw new Error(`Empty release artifact for ${name}`);
  for await (const chunk of response.body) digest.update(chunk);
  return `sha512-${digest.digest("base64")}`;
};

export async function verifyCatalog(directory: string, released = false): Promise<void> {
  const catalog: Catalog = await Bun.file(join(directory, "catalog.json")).json();
  for (const [name, pkg] of Object.entries(catalog.packages)) {
    if (!pkg.tarball || !pkg.integrity) throw new Error(`Missing packed artifact or integrity for ${name}`);
    const tarball = resolve(directory, pkg.tarball);
    const bytes = await Bun.file(tarball).arrayBuffer();
    const integrity = `sha512-${new Bun.CryptoHasher("sha512").update(bytes).digest("base64")}`;
    if (integrity !== pkg.integrity) throw new Error(`Packed artifact changed: ${name}`);
    const archive = Bun.spawn(["tar", "-xOf", tarball, "package/package.json"], { stdout: "pipe", stderr: "pipe" });
    const [code, text, stderr] = await Promise.all([
      archive.exited,
      new Response(archive.stdout).text(),
      new Response(archive.stderr).text(),
    ]);
    if (code !== 0) throw new Error(`Cannot inspect ${name}: ${stderr}`);
    const manifest = JSON.parse(text);
    if (
      manifest.name !== name ||
      manifest.version !== catalog.version ||
      manifest.scripts ||
      manifest.private !== true
    ) {
      throw new Error(`Unexpected packed manifest for ${name}`);
    }
    if (released && (await publishedIntegrity(name, catalog.version)) !== integrity) {
      throw new Error(`GitHub release differs from the tested artifact: ${name}@${catalog.version}`);
    }
    console.log(
      `Verified ${released ? "GitHub release" : "local artifact"} ${name}@${catalog.version}: ${bytes.byteLength} bytes`,
    );
  }
  console.log(
    `${released ? "GitHub release" : "Dry run"} checked ${Object.keys(catalog.packages).length} Atlas libraries at ${catalog.version}`,
  );
}

if (import.meta.main) {
  if (Bun.argv.includes("--publish"))
    throw new Error("Use the repository's GitHub release workflow to upload tested artifacts");
  const directory = resolve(Bun.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "out/distribution");
  await verifyCatalog(directory, Bun.argv.includes("--verify-release"));
}
