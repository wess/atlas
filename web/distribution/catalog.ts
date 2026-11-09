#!/usr/bin/env bun
// the cli reads this committed catalog to pin scaffolds, so it has to move with the source
import { join } from "node:path";
import { build } from "./build.ts";
import { sourceRoot } from "./config.ts";

const { catalog } = await build({ pack: false });
await Bun.write(
  join(sourceRoot, "packages/cli/modules/catalog.json"),
  `${JSON.stringify({ version: catalog.version, exports: catalog.exports }, null, 2)}\n`,
);
console.log(`Catalog updated for ${catalog.version}: ${Object.keys(catalog.exports).length} entry points`);
