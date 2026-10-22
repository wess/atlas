import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../build.ts";
import { readConfig } from "../config.ts";
import { createGraph, rewriteSource, selectEntrypoints } from "../graph.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function fixture(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "atlasdistribution"));
  roots.push(root);
  const files: Record<string, string> = {
    "package.json": JSON.stringify({
      name: "@wess/atlas",
      version: "1.2.3",
      exports: {
        "./server": "./packages/server/index.ts",
        "./db": "./packages/db/index.ts",
        "./ui/*": "./packages/ui/*/index.tsx",
        "./packages/*": "./packages/*",
      },
      peerDependencies: { react: "^19.0.0", zod: "^4.0.0" },
    }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "preserve",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        paths: { "@atlas/db": ["./packages/db/index.ts"] },
      },
    }),
    "node_modules/react/package.json": JSON.stringify({ name: "react", version: "19.0.0" }),
    "node_modules/zod/package.json": JSON.stringify({ name: "zod", version: "4.0.0" }),
    "packages/server/index.ts": [
      'export type { Row } from "../db";',
      'export { local } from "./local";',
      'export const load = () => import("../db/leaf/index.ts");',
      'export type Shape = import("@atlas/db").Row;',
      'export const text = `import("imaginary")`;',
      '// import type { Fake } from "missing";',
    ].join("\n"),
    "packages/server/local.ts": "export const local = 42;\n",
    "packages/server/AGENTS.md": "server docs",
    "packages/server/test/secret.test.ts": 'import "should-not-ship";',
    "packages/server/tsconfig.json": "{}",
    "packages/db/index.ts": 'export type { Row } from "./row.ts";',
    "packages/db/row.ts": 'import type { ZodType } from "zod"; export type Row = ZodType;',
    "packages/db/leaf/index.ts": "export const value = 1;",
    "packages/ui/index.ts": 'export { block } from "./block/index.tsx";',
    "packages/ui/block/index.tsx": "export const block = <span />;",
    "packages/ui/hidden/internal.ts": "export const hidden = true;",
  };
  for (const [name, content] of Object.entries(files)) await Bun.write(join(root, name), content);
  return root;
}

test("type imports, reexports, aliases, dynamic imports and extensionless indexes form the closure", async () => {
  const root = await fixture();
  const config = await readConfig(root);
  const graph = await createGraph(config);
  expect(selectEntrypoints(config, graph, [config.entries["./server"]!])).toEqual({
    packages: ["@wess/atlas-db", "@wess/atlas-server"],
    externals: { zod: "4.0.0" },
  });
  const file = config.entries["./server"]!;
  const rewritten = rewriteSource(config, file, graph.get(file)!);
  expect(rewritten).toContain('from "@wess/atlas-db"');
  expect(rewritten).toContain('import("@wess/atlas-db/leaf/index.ts")');
  expect(rewritten).toContain('import("@wess/atlas-db").Row');
  expect(rewritten).toContain('from "./local"');
  expect(rewritten).toContain('`import("imaginary")`');
});

test("build expands real block exports and produces source-only packages with optional peers", async () => {
  const root = await fixture();
  const { catalog, mapping, outdir } = await build({ root, pack: false });
  expect(mapping).toBe(catalog.exports);
  expect(Object.keys(mapping)).toEqual(["./db", "./server", "./ui/block"]);
  expect(mapping["./ui/block"]!.externals).toEqual({ react: "19.0.0" });
  const backing = await Bun.file(join(outdir, "atlas-server/package.json")).json();
  expect(backing.version).toBe("1.2.3");
  expect(backing.exports).toEqual({ ".": "./packages/server/index.ts", "./*": "./packages/server/*" });
  expect(backing.dependencies).toBeUndefined();
  expect(backing.peerDependencies).toEqual({ "@wess/atlas-db": "1.2.3" });
  expect(backing.peerDependenciesMeta).toEqual({ "@wess/atlas-db": { optional: true } });
  expect(await Bun.file(join(outdir, "atlas-server/packages/server/test/secret.test.ts")).exists()).toBe(false);
  expect(await Bun.file(join(outdir, "atlas-server/packages/server/tsconfig.json")).exists()).toBe(false);
  const facade = await Bun.file(join(outdir, "atlas/package.json")).json();
  expect(facade.dependencies).toBeUndefined();
  expect(Object.keys(facade.peerDependencies)).toEqual(["@wess/atlas-db", "@wess/atlas-server", "@wess/atlas-ui"]);
  expect(await Bun.file(join(outdir, "atlas/server.ts")).text()).toBe('export * from "@wess/atlas-server";\n');
  expect(await Bun.file(join(outdir, "catalog.json")).json()).toEqual(catalog);
});

test("undeclared type-only external and unresolved local imports fail the build", async () => {
  const root = await fixture();
  await Bun.write(join(root, "packages/server/index.ts"), 'import type { Missing } from "undeclared/types";');
  let failure: unknown;
  try {
    await createGraph(await readConfig(root));
  } catch (error) {
    failure = error;
  }
  expect(String(failure)).toContain("Undeclared external undeclared");
  await Bun.write(join(root, "packages/server/index.ts"), 'export type { Missing } from "./missing";');
  failure = undefined;
  try {
    await createGraph(await readConfig(root));
  } catch (error) {
    failure = error;
  }
  expect(String(failure)).toContain("Unresolved source import ./missing");
});

test("required external peers are explicit, compatible, and pinned to tested versions", async () => {
  const root = await fixture();
  const manifest = await Bun.file(join(root, "package.json")).json();
  Object.assign(manifest.peerDependencies, {
    "@mantine/core": "^9.0.0",
    "@mantine/hooks": "^9.0.0",
    "react-dom": "^19.0.0",
  });
  await Bun.write(join(root, "package.json"), JSON.stringify(manifest));
  const core = {
    name: "@mantine/core",
    version: "9.0.0",
    peerDependencies: { "@mantine/hooks": "9.0.0", react: "^19.0.0", "react-dom": "^19.0.0", unused: "*" },
    peerDependenciesMeta: { unused: { optional: true } },
  };
  await Bun.write(join(root, "node_modules/@mantine/core/package.json"), JSON.stringify(core));
  for (const [name, version] of [
    ["@mantine/hooks", "9.0.0"],
    ["react-dom", "19.0.0"],
  ])
    await Bun.write(join(root, "node_modules", name!, "package.json"), JSON.stringify({ name, version }));
  await Bun.write(join(root, "packages/ui/block/index.tsx"), 'export { MantineProvider } from "@mantine/core";');
  const config = await readConfig(root);
  const graph = await createGraph(config);
  expect(selectEntrypoints(config, graph, [config.entries["./ui/block"]!]).externals).toEqual({
    "@mantine/core": "9.0.0",
    "@mantine/hooks": "9.0.0",
    react: "19.0.0",
    "react-dom": "19.0.0",
  });
  core.peerDependencies.react = "^18.0.0";
  await Bun.write(join(root, "node_modules/@mantine/core/package.json"), JSON.stringify(core));
  const incompatible = await readConfig(root);
  expect(() => selectEntrypoints(incompatible, graph, [config.entries["./ui/block"]!])).toThrow("requires react");
});
