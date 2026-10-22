import catalog from "./catalog.json";
import { releaseUrl } from "./source.ts";

type Selection = { packages: string[]; externals: Record<string, string> };
type Catalog = { version: string; exports: Record<string, Selection> };

const modules: Catalog = catalog;
export const version = modules.version;
export const availableModules = Object.keys(modules.exports)
  .map((name) => name.replace(/^\.\//, ""))
  .sort();

export const moduleDependencies = (names: readonly string[]): Record<string, string> => {
  const dependencies: Record<string, string> = { "@wess/atlas": releaseUrl("@wess/atlas", version) };
  for (const name of names) {
    const key = `./${name.replace(/^@wess\/atlas\//, "").replace(/^\.\//, "")}`;
    const selection = modules.exports[key];
    if (!selection) throw new Error(`Unknown Atlas module: ${name}. Run atlas add to list available modules.`);
    for (const module of selection.packages) dependencies[module] = releaseUrl(module, version);
    Object.assign(dependencies, selection.externals);
  }
  return dependencies;
};
