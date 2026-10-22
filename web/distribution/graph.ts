// graph edges include type-only, re-export, and literal dynamic references
import { builtinModules } from "node:module";
import { dirname, extname, join, relative, resolve } from "node:path";
import { moduleOf, packageImport, packageName, type SourceConfig } from "./config.ts";
import { type ParsedSource, parseSources, type Reference } from "./parse.ts";
import { externalClosure } from "./peers.ts";

export type Edge = Reference & { target?: string; external?: string };
export type SourceNode = ParsedSource & { edges: Edge[] };
export type Graph = Map<string, SourceNode>;
export type Selection = { packages: string[]; externals: Record<string, string> };

const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
const externalName = (name: string): string =>
  name.startsWith("@") ? name.split("/").slice(0, 2).join("/") : name.split("/")[0]!;
const isBuiltin = (name: string): boolean => builtins.has(name) || name === "bun" || name.startsWith("bun:");

const resolveFile = (candidate: string, files: Set<string>): string | undefined => {
  if (files.has(candidate)) return candidate;
  const stem = /\.[cm]?jsx?$/.test(candidate) ? candidate.slice(0, -extname(candidate).length) : candidate;
  return [
    ...[".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".d.ts"].map((ext) => `${stem}${ext}`),
    ...["index.ts", "index.tsx", "index.js", "index.d.ts"].map((name) => join(candidate, name)),
  ].find((file) => files.has(file));
};

const aliasPaths = (name: string, config: SourceConfig): string[] => {
  const exact = config.aliases[name];
  if (exact) return exact.map((path) => resolve(config.root, path));
  for (const [key, targets] of Object.entries(config.aliases)) {
    if (!key.includes("*")) continue;
    const [prefix = "", suffix = ""] = key.split("*");
    if (!name.startsWith(prefix) || !name.endsWith(suffix)) continue;
    const match = name.slice(prefix.length, name.length - suffix.length || undefined);
    return targets.map((path) => resolve(config.root, path.replace("*", match)));
  }
  const publicPath = name.startsWith("@atlas/")
    ? `./${name.slice(7)}`
    : name.startsWith("@wess/atlas/")
      ? `./${name.slice(12)}`
      : undefined;
  if (publicPath && config.entries[publicPath]) return [config.entries[publicPath]];
  if (name.startsWith("@wess/atlas-")) {
    const [module = "", ...parts] = name.slice(12).split("/");
    return [join(config.root, "packages", module, parts.join("/") || "index.ts")];
  }
  return [];
};

export async function createGraph(config: SourceConfig): Promise<Graph> {
  const scripts = config.files.filter((path) => /\.[cm]?[jt]sx?$/.test(path));
  const parsed = await parseSources(config.root, scripts);
  const files = new Set(config.files);
  const graph: Graph = new Map();
  for (const [file, source] of parsed) {
    const edges: Edge[] = source.references.map((ref) => {
      const candidates = ref.name.startsWith(".") ? [resolve(dirname(file), ref.name)] : aliasPaths(ref.name, config);
      if (candidates.length) {
        const target = candidates.map((path) => resolveFile(path, files)).find(Boolean);
        if (!target) throw new Error(`Unresolved source import ${ref.name} in ${relative(config.root, file)}`);
        return { ...ref, target };
      }
      if (ref.name.startsWith("@atlas/") || ref.name.startsWith("@wess/atlas")) {
        throw new Error(`Unknown Atlas import ${ref.name} in ${relative(config.root, file)}`);
      }
      if (isBuiltin(ref.name)) return ref;
      const external = externalName(ref.name);
      if (!config.versions[external]) {
        throw new Error(`Undeclared external ${external} in ${relative(config.root, file)}`);
      }
      return { ...ref, external };
    });
    if (source.jsx) {
      if (!config.versions.react) throw new Error(`Undeclared JSX runtime react in ${file}`);
      edges.push({ name: "react/jsx-runtime", external: "react", start: -1, end: -1 });
    }
    graph.set(file, { ...source, edges });
  }
  return graph;
}

export const selectEntrypoints = (config: SourceConfig, graph: Graph, entries: string[]): Selection => {
  const visited = new Set<string>();
  const packages = new Set<string>();
  const externals: Record<string, string> = {};
  const visit = (file: string): void => {
    if (visited.has(file)) return;
    visited.add(file);
    const module = moduleOf(config.root, file);
    if (!module) throw new Error(`Entrypoint outside packages: ${file}`);
    packages.add(packageName(module));
    for (const edge of graph.get(file)?.edges ?? []) {
      if (edge.target) visit(edge.target);
      if (edge.external) externals[edge.external] = config.versions[edge.external]!;
    }
  };
  for (const entry of entries) visit(entry);
  return {
    packages: [...packages].sort(),
    externals: externalClosure(config.externals, Object.keys(externals)),
  };
};

export const rewriteSource = (config: SourceConfig, file: string, source: SourceNode): string => {
  const module = moduleOf(config.root, file);
  let text = source.text;
  for (const edge of [...source.edges].sort((a, b) => b.start - a.start)) {
    if (!edge.target || edge.start < 0) continue;
    const sameModule = moduleOf(config.root, edge.target) === module;
    if (sameModule && edge.name.startsWith(".")) continue;
    const replacement = sameModule
      ? `./${relative(dirname(file), edge.target)}`
      : packageImport(config.root, edge.target);
    text = text.slice(0, edge.start) + JSON.stringify(replacement) + text.slice(edge.end);
  }
  return text;
};

export const modulePeers = (config: SourceConfig, graph: Graph, module: string): Record<string, string> => {
  const peers: Record<string, string> = {};
  for (const [file, node] of graph) {
    if (moduleOf(config.root, file) !== module) continue;
    for (const edge of node.edges) {
      const target = edge.target && moduleOf(config.root, edge.target);
      if (target && target !== module) peers[packageName(target)] = config.manifest.version;
      if (edge.external) peers[edge.external] = config.versions[edge.external]!;
    }
  }
  for (const name of Object.keys(
    externalClosure(
      config.externals,
      Object.keys(peers).filter((name) => !name.startsWith("@wess/atlas-")),
    ),
  )) {
    peers[name] = config.versions[name]!;
  }
  return Object.fromEntries(Object.entries(peers).sort(([a], [b]) => a.localeCompare(b)));
};
