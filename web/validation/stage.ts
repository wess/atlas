import { lstatSync, readdirSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { type Consumer, portfolio } from "./apps.ts";
import { migrateCompatibility } from "./compatibility.ts";
import { migrateImports } from "./imports.ts";

const ignored = new Set(["node_modules", "dist", "build", "target", "vendor", "coverage", "certs"]);
const directories = new Set([
  "web",
  "src",
  "tests",
  "test",
  "scripts",
  "migrations",
  "public",
  "plugins",
  "plugin",
  "templates",
  "site",
  "assets",
  "app",
  "components",
  "client",
  "skills",
  "docs",
]);

const collect = (root: string, directory = root): string[] =>
  readdirSync(directory)
    .sort()
    .flatMap((name) => {
      if (name.startsWith(".") || ignored.has(name)) return [];
      if ((directory === root || directory === join(root, "web")) && ["data", "backups", "logs"].includes(name))
        return [];
      const path = join(directory, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) return [];
      if (stat.isDirectory()) {
        if (directory === root && !directories.has(name)) return [];
        return collect(root, path);
      }
      if (/\.(?:sqlite|db|pem|key|p8|p12|pfx|tgz|log)(?:\.|$)/i.test(name)) return [];
      if (directory === root && !/\.(?:[cm]?[jt]sx?|json|toml|html|css|md)$/.test(name)) return [];
      if (directory === root && /\.json$/.test(name) && !/^(?:package|biome|tsconfig[^/]*)\.json$/.test(name))
        return [];
      return [path];
    });

export const stageConsumer = async (app: Consumer, destination: string, source = portfolio): Promise<string> => {
  source = resolve(source);
  destination = resolve(destination);
  const root = resolve(source, app.path);
  const target = resolve(destination, app.path);
  if (
    destination === source ||
    destination.startsWith(`${source}/`) ||
    !target.startsWith(`${destination}/`) ||
    target === root ||
    target.startsWith(`${root}/`) ||
    root.startsWith(`${target}/`)
  )
    throw new Error(`Unsafe consumer staging destination: ${target}`);
  for (const path of collect(root)) {
    const output = join(target, relative(root, path));
    if (/\.[cm]?[jt]sx?$/.test(path)) {
      await Bun.write(
        output,
        migrateCompatibility(app.name, relative(root, path), migrateImports(await Bun.file(path).text())),
      );
    } else if (/^tsconfig.*\.json$/.test(basename(path))) {
      // app configs are JSONC; remove only Atlas aliases and preserve every other setting
      let text = await Bun.file(path).text();
      text = text.replace(/"(?:@atlas\/|atlas\/|@wess\/atlas\/)[^"\n]*"\s*:\s*(?:\[[^\]]*\]|"[^"\n]*")\s*,?/g, "");
      text = text.replace(/,\s*}/g, "}");
      await Bun.write(output, text);
    } else if (basename(path) === "package.json") {
      const manifest = await Bun.file(path).json();
      // the old patch targets a package layout absent from the modular release
      if (manifest.scripts?.postinstall === "bun scripts/patchbilling.ts") delete manifest.scripts.postinstall;
      for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
        for (const dependency of Object.keys(manifest[key] ?? {})) {
          if (dependency === "atlas" || dependency.startsWith("@atlas/") || dependency.startsWith("@wess/atlas")) {
            delete manifest[key][dependency];
          }
        }
      }
      await Bun.write(output, `${JSON.stringify(manifest, null, 2)}\n`);
    } else {
      await Bun.write(output, Bun.file(path));
    }
  }
  return resolve(target, app.package);
};

export const atlasImports = async (root: string): Promise<string[]> => {
  const names = new Set<string>();
  const visit = async (directory: string): Promise<void> => {
    for (const name of readdirSync(directory)) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const path = join(directory, name);
      if (lstatSync(path).isDirectory()) await visit(path);
      else if (/\.[cm]?[jt]sx?$/.test(name)) {
        const text = await Bun.file(path).text();
        for (const match of text.matchAll(/(?:from\s*|import\s*\(|require\s*\()(["'])(@wess\/atlas\/[^"']+)\1/g)) {
          names.add(match[2]!.replace("@wess/atlas/", "./"));
        }
      }
    }
  };
  await visit(root);
  return [...names].sort();
};
