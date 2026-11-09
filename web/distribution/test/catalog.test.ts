import { expect, test } from "bun:test";
import { join } from "node:path";
import { readConfig, sourceRoot } from "../config.ts";
import { createGraph, selectEntrypoints } from "../graph.ts";

test("the committed catalog matches the source, so scaffolds pin what actually ships", async () => {
  const config = await readConfig(sourceRoot);
  const graph = await createGraph(config);
  const committed = await Bun.file(join(sourceRoot, "packages/cli/modules/catalog.json")).json();
  expect(committed.version).toBe(config.manifest.version);
  expect(Object.keys(committed.exports).sort()).toEqual(Object.keys(config.entries).sort());
  for (const [key, entry] of Object.entries(config.entries)) {
    const { packages, externals } = selectEntrypoints(config, graph, [entry]);
    expect({ key, packages, externals }).toEqual({
      key,
      packages: committed.exports[key].packages,
      externals: committed.exports[key].externals,
    });
  }
});
