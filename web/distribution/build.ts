#!/usr/bin/env bun
// selective source packages and a facade with one entrypoint per public subpath
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  moduleOf,
  packageImport,
  packageName,
  readConfig,
  type SourceConfig,
  sourceFiles,
  sourceRoot,
} from "./config.ts";
import { createGraph, modulePeers, rewriteSource, type Selection, selectEntrypoints } from "./graph.ts";

export type CatalogEntry = Selection & { entry: string; package: string; import: string };
export type CatalogPackage = { directory: string; tarball?: string; integrity?: string; peers: Record<string, string> };
export type Catalog = {
  version: string;
  facade: string;
  packages: Record<string, CatalogPackage>;
  exports: Record<string, CatalogEntry>;
};
export type BuildOptions = { root?: string; outdir?: string; pack?: boolean };
export type BuildResult = { outdir: string; catalog: Catalog; mapping: Record<string, CatalogEntry> };

const json = (path: string, value: unknown) => Bun.write(path, `${JSON.stringify(value, null, 2)}\n`);
const optionalPeers = (peers: Record<string, string>) => ({
  peerDependencies: peers,
  peerDependenciesMeta: Object.fromEntries(Object.keys(peers).map((name) => [name, { optional: true }])),
});
const metadata = (config: SourceConfig) => ({
  version: config.manifest.version,
  type: "module",
  engines: { bun: ">=1.4.4" },
  license: config.manifest.license,
  repository: config.manifest.repository,
  private: true,
});

async function copyAssets(config: SourceConfig, dir: string, module: string): Promise<void> {
  const roots = ["LICENSE", "LICENSE.md", "LICENSE.txt"];
  if (module === "cli" || module === "mcp") {
    roots.push("llms.txt", "SOUL.md", "CLAUDE.md", "README.md");
    for (const file of sourceFiles(join(config.root, "docs"))) {
      await Bun.write(join(dir, relative(config.root, file)), Bun.file(file));
    }
    for (const sibling of config.modules) {
      const path = join("packages", sibling, "AGENTS.md");
      if (existsSync(join(config.root, path))) await Bun.write(join(dir, path), Bun.file(join(config.root, path)));
    }
  }
  if (module === "cli") {
    for (const file of new Bun.Glob("**/*").scanSync({ cwd: join(config.root, "templates"), dot: true })) {
      if (/(^|\/)(node_modules|dist|build|\.git)(\/|$)/.test(file)) continue;
      if (/(^|\/)\.env$|\.tsbuildinfo$/.test(file)) continue;
      await Bun.write(join(dir, "templates", file), Bun.file(join(config.root, "templates", file)));
    }
  }
  for (const file of roots) {
    const path = [join(config.root, file), join(config.root, "..", file)].find(existsSync);
    if (path) await Bun.write(join(dir, file), Bun.file(path));
  }
}

async function pack(dir: string, outdir: string, name: string, version: string): Promise<string> {
  const tarball = `${name.replace(/^@/, "").replaceAll("/", "-")}-${version}.tgz`;
  const proc = Bun.spawn(["bun", "pm", "pack", "--destination", outdir, "--ignore-scripts", "--quiet"], {
    cwd: dir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  if (code !== 0) throw new Error(`Packing ${name} failed: ${stderr}`);
  if (!(await Bun.file(join(outdir, tarball)).exists())) throw new Error(`Missing tarball ${tarball}`);
  return tarball;
}

export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  const config = await readConfig(options.root ?? sourceRoot);
  const outdir = resolve(options.outdir ?? join(config.root, "out", "distribution"));
  // keep cleanup confined to the generated tree, even when a caller supplies outdir
  if (outdir === config.root || config.root.startsWith(`${outdir}/`) || outdir === "/") {
    throw new Error(`Unsafe distribution output: ${outdir}`);
  }
  if (outdir.startsWith(`${config.root}/`) && !outdir.startsWith(`${config.root}/out/`)) {
    throw new Error(`Distribution output inside source must be under out/: ${outdir}`);
  }
  const graph = await createGraph(config);
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  const catalog: Catalog = { version: config.manifest.version, facade: "@wess/atlas", packages: {}, exports: {} };
  for (const module of config.modules) {
    const name = packageName(module);
    const directory = `atlas-${module}`;
    const dir = join(outdir, directory);
    const peers = modulePeers(config, graph, module);
    for (const file of config.files.filter((file) => moduleOf(config.root, file) === module)) {
      const dest = join(dir, relative(config.root, file));
      const source = graph.get(file);
      await Bun.write(dest, source ? rewriteSource(config, file, source) : Bun.file(file));
    }
    await copyAssets(config, dir, module);
    const bin = Object.fromEntries(
      Object.entries(config.manifests[module]?.bin ?? {}).map(([key, path]) => [
        key,
        `./packages/${module}/${path.replace(/^\.\//, "")}`,
      ]),
    );
    await json(join(dir, "package.json"), {
      name,
      ...metadata(config),
      exports: { ".": `./packages/${module}/index.ts`, "./*": `./packages/${module}/*` },
      ...(Object.keys(bin).length ? { bin } : {}),
      ...optionalPeers(peers),
    });
    catalog.packages[name] = { directory, peers };
  }
  const facadeDir = join(outdir, "atlas");
  const exports: Record<string, string> = {};
  const facadePeers: Record<string, string> = {};
  for (const [key, entry] of Object.entries(config.entries).sort(([a], [b]) => a.localeCompare(b))) {
    const path = key === "." ? "./index.ts" : `${key}.ts`;
    const target = packageImport(config.root, entry);
    await Bun.write(join(facadeDir, path), `export * from ${JSON.stringify(target)};\n`);
    exports[key] = path;
    const name = packageName(moduleOf(config.root, entry)!);
    facadePeers[name] = config.manifest.version;
    catalog.exports[key] = {
      entry: relative(config.root, entry),
      package: name,
      import: target,
      ...selectEntrypoints(config, graph, [entry]),
    };
  }
  await json(join(facadeDir, "package.json"), {
    name: catalog.facade,
    ...metadata(config),
    description: config.manifest.description,
    exports,
    ...optionalPeers(facadePeers),
  });
  await copyAssets(config, facadeDir, "facade");
  catalog.packages[catalog.facade] = { directory: "atlas", peers: facadePeers };
  if (config.modules.includes("cli")) {
    await json(join(outdir, "atlas-cli/packages/cli/modules/catalog.json"), {
      version: catalog.version,
      exports: catalog.exports,
    });
  }
  if (options.pack !== false) {
    for (const [name, pkg] of Object.entries(catalog.packages)) {
      pkg.tarball = await pack(join(outdir, pkg.directory), outdir, name, catalog.version);
      const bytes = await Bun.file(join(outdir, pkg.tarball)).arrayBuffer();
      pkg.integrity = `sha512-${new Bun.CryptoHasher("sha512").update(bytes).digest("base64")}`;
    }
  }
  await json(join(outdir, "catalog.json"), catalog);
  return { outdir, catalog, mapping: catalog.exports };
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  const outdir = args.find((arg) => !arg.startsWith("--"));
  const result = await build({ outdir, pack: !args.includes("--no-pack") });
  console.log(`Built ${Object.keys(result.catalog.packages).length} packages in ${result.outdir}`);
}
