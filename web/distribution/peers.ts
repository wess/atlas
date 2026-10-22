import { join } from "node:path";

export type External = { version: string; peers: Record<string, string> };

export async function readExternals(root: string, versions: Record<string, string>): Promise<Record<string, External>> {
  const result: Record<string, External> = {};
  for (const [name, range] of Object.entries(versions)) {
    const file = Bun.file(join(root, "node_modules", name, "package.json"));
    if (!(await file.exists())) throw new Error(`Install source dependencies before packing: missing ${name}`);
    const manifest = await file.json();
    if (!Bun.semver.satisfies(manifest.version, range))
      throw new Error(`Installed ${name}@${manifest.version} does not satisfy ${range}`);
    result[name] = {
      version: manifest.version,
      peers: Object.fromEntries(
        Object.entries(manifest.peerDependencies ?? {}).filter(
          ([peer]) => manifest.peerDependenciesMeta?.[peer]?.optional !== true,
        ),
      ) as Record<string, string>,
    };
  }
  return result;
}

export const externalClosure = (installed: Record<string, External>, roots: string[]): Record<string, string> => {
  const selected: Record<string, string> = {};
  const visit = (name: string): void => {
    if (selected[name]) return;
    const manifest = installed[name];
    if (!manifest) throw new Error(`Declare and install required external peer ${name}`);
    selected[name] = manifest.version;
    for (const [peer, range] of Object.entries(manifest.peers)) {
      const version = installed[peer]?.version;
      if (!version || !Bun.semver.satisfies(version, range))
        throw new Error(`${name} requires ${peer}@${range}; installed ${version ?? "nothing"}`);
      visit(peer);
    }
  };
  for (const name of roots) visit(name);
  return Object.fromEntries(Object.entries(selected).sort(([a], [b]) => a.localeCompare(b)));
};
