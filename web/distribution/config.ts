// source layout and public entrypoints
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { type External, readExternals } from "./peers.ts";

export type Manifest = {
  name: string;
  version: string;
  description?: string;
  license?: string;
  repository?: unknown;
  exports?: Record<string, string | Record<string, string>>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  bin?: Record<string, string>;
};

export type SourceConfig = {
  root: string;
  manifest: Manifest;
  modules: string[];
  files: string[];
  entries: Record<string, string>;
  aliases: Record<string, string[]>;
  versions: Record<string, string>;
  manifests: Record<string, Manifest>;
  externals: Record<string, External>;
};

const ignored = new Set(["test", "tests", "__tests__", "node_modules", "dist", "build", "coverage", ".git"]);

export const sourceFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      if (ignored.has(name) || (name.startsWith(".") && name !== ".env.example")) return [];
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      if (/^(package\.json|tsconfig.*\.json|bun\.lockb?|.*\.tsbuildinfo)$/.test(name)) return [];
      if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(name)) return [];
      return /\.(?:[cm]?[jt]sx?|json|css|html|md|sql|svg|txt)$/.test(name) ? [path] : [];
    });
};

export const moduleOf = (root: string, path: string): string | undefined => {
  const parts = relative(join(root, "packages"), path).split("/");
  return parts.length > 1 && parts[0] !== ".." ? parts[0] : undefined;
};

export const packageName = (module: string): string => `@wess/atlas-${module}`;

export const packageImport = (root: string, path: string): string => {
  const module = moduleOf(root, path);
  if (!module) throw new Error(`Source outside packages: ${path}`);
  const subpath = relative(join(root, "packages", module), path);
  return subpath === "index.ts" ? packageName(module) : `${packageName(module)}/${subpath}`;
};

export async function readConfig(root: string): Promise<SourceConfig> {
  root = resolve(root);
  const manifest = (await Bun.file(join(root, "package.json")).json()) as Manifest;
  const modules = readdirSync(join(root, "packages"))
    .filter((name) => existsSync(join(root, "packages", name, "index.ts")))
    .sort();
  const files = modules.flatMap((name) => sourceFiles(join(root, "packages", name)));
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(manifest.exports ?? {})) {
    // the old raw-file escape hatch is not a public module entrypoint
    if (key.startsWith("./packages/")) continue;
    const target = typeof value === "string" ? value : (value.import ?? value.default);
    if (!target) throw new Error(`No source entrypoint for ${key}`);
    if (key.includes("*")) {
      const [prefix = "", suffix = ""] = target.replace(/^\.\//, "").split("*");
      for (const file of files) {
        const local = relative(root, file);
        if (!local.startsWith(prefix) || !local.endsWith(suffix)) continue;
        const match = local.slice(prefix.length, local.length - suffix.length || undefined);
        if (match.includes("/")) continue;
        entries[key.replace("*", match)] = file;
      }
    } else {
      const file = resolve(root, target);
      if (!files.includes(file)) throw new Error(`Missing source entrypoint ${key}: ${file}`);
      entries[key] = file;
    }
  }
  const tsconfig = Bun.file(join(root, "tsconfig.json"));
  const aliases: Record<string, string[]> = (await tsconfig.exists())
    ? ((await tsconfig.json()).compilerOptions?.paths ?? {})
    : {};
  const versions: Record<string, string> = {
    ...manifest.peerDependencies,
    ...manifest.dependencies,
  };
  const manifests: Record<string, Manifest> = {};
  for (const module of modules) {
    const file = Bun.file(join(root, "packages", module, "package.json"));
    if (!(await file.exists())) continue;
    const local = (await file.json()) as Manifest;
    manifests[module] = local;
    for (const [name, version] of Object.entries({ ...local.peerDependencies, ...local.dependencies })) {
      if (!name.startsWith("@atlas/") && !name.startsWith("@wess/atlas")) versions[name] ??= version;
    }
  }
  const externals = await readExternals(root, versions);
  return { root, manifest, modules, files, entries, aliases, versions, manifests, externals };
}

export const sourceRoot = resolve(dirname(import.meta.path), "..");
