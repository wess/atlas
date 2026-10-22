import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Catalog } from "../distribution/build.ts";
import { releaseUrl } from "../packages/cli/modules/source.ts";
import { atlasImports, stageConsumer } from "./stage.ts";

const sites = ["undercover", "schorror", "apothecary", "803media", "inkling-site", "warrenpublishing"];

const run = async (directory: string, args: string[], log: string): Promise<number> => {
  const child = Bun.spawn([process.execPath, "--no-env-file", ...args], {
    cwd: directory,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  await Bun.write(join(directory, log), stdout + stderr);
  return code;
};

export async function validateFleet(
  artifacts: string,
  inkling: string,
  clients: string,
  destination: string,
): Promise<void> {
  artifacts = resolve(artifacts);
  destination = resolve(destination);
  for (const source of [resolve(inkling), resolve(clients), artifacts]) {
    if (destination === source || destination.startsWith(`${source}/`) || source.startsWith(`${destination}/`)) {
      throw new Error(`Unsafe fleet staging destination: ${destination}`);
    }
  }
  const catalog: Catalog = await Bun.file(join(artifacts, "catalog.json")).json();
  const library = join(destination, "inklinglibrary");
  await mkdir(library, { recursive: true });
  for (const name of ["src", "plugins", "migrations", "public", "templates", "skills", "docs"]) {
    if (existsSync(join(inkling, name))) await cp(join(inkling, name), join(library, name), { recursive: true });
  }
  const manifest = await Bun.file(join(inkling, "package.json")).json();
  manifest.files = ["src", "plugins", "migrations", "public", "templates", "skills", "docs"];
  delete manifest.scripts;
  for (const name of Object.keys(manifest.dependencies)) {
    const pkg = catalog.packages[name];
    if (pkg) manifest.dependencies[name] = join(artifacts, pkg.tarball!);
  }
  await Bun.write(join(library, "package.json"), JSON.stringify(manifest, null, 2));
  if ((await run(library, ["pm", "pack", "--ignore-scripts", "--destination", destination], "pack.log")) !== 0) {
    throw new Error("Inkling candidate packing failed");
  }
  const tarball = join(destination, `inkling-${manifest.version}.tgz`);
  const results: { site: string; directory: string; install: number; typecheck?: number; audit?: number }[] = [];
  for (const site of sites) {
    const directory = await stageConsumer({ name: site, path: site, package: "." }, destination, clients);
    const path = join(directory, "package.json");
    const app = await Bun.file(path).json();
    Object.assign(app.devDependencies, {
      typescript: "7.0.2",
      "@types/bun": "^1.4.3",
      "@types/react": "^19.3.0",
      "@types/react-dom": "^19.3.0",
    });
    for (const entry of await atlasImports(directory)) {
      const selection = catalog.exports[entry];
      if (!selection) throw new Error(`${site}: unsupported import ${entry}`);
      app.dependencies[catalog.facade] = releaseUrl(catalog.facade, catalog.version);
      for (const name of selection.packages) app.dependencies[name] = releaseUrl(name, catalog.version);
      Object.assign(app.dependencies, selection.externals);
    }
    const intended = structuredClone(app);
    // the next Inkling tag must be released with GitHub-backed Atlas dependencies
    intended.dependencies.inkling = `github:wess/inkling#v${manifest.version}`;
    intended.engines = { ...intended.engines, bun: ">=1.4.4" };
    await Bun.write(join(directory, "migration.json"), JSON.stringify(intended, null, 2));
    app.dependencies.inkling = tarball;
    for (const name of Object.keys(app.dependencies)) {
      const pkg = catalog.packages[name];
      if (pkg) app.dependencies[name] = join(artifacts, pkg.tarball!);
    }
    await Bun.write(path, JSON.stringify(app, null, 2));
    const result: (typeof results)[number] = {
      site,
      directory,
      install: await run(directory, ["install", "--ignore-scripts"], "install.log"),
    };
    if (result.install === 0) {
      result.typecheck = await run(directory, ["x", "--no-install", "tsc", "--noEmit"], "typecheck.log");
      result.audit = await run(directory, ["audit", "--json"], "audit.json");
    }
    results.push(result);
    await Bun.write(join(destination, "results.json"), JSON.stringify(results, null, 2));
    console.log(`${site}: install=${result.install} typecheck=${result.typecheck} audit=${result.audit}`);
  }
  if (results.some((result) => result.install || result.typecheck || result.audit)) process.exitCode = 1;
}

if (import.meta.main) {
  const [
    artifacts = "out/distribution",
    inkling = "/tmp/atlaslatest/inkling",
    clients = "/Users/wess/Desktop/clients",
    destination = "/tmp/atlasfleet",
  ] = Bun.argv.slice(2);
  await validateFleet(artifacts, inkling, clients, destination);
}
