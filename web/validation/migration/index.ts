import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import type { Catalog } from "../../distribution/build.ts";
import { publishedIntegrity } from "../../distribution/publish.ts";
import { cliCommand, releaseUrl } from "../../packages/cli/modules/source.ts";
import { consumers, portfolio } from "../apps.ts";
import { stageConsumer } from "../stage.ts";

type Change = { path: string; before: string | null; content: string | null };
type App = { name: string; root: string; package: string; changes: Change[] };
type Bundle = { version: string; artifacts: string; apps: App[] };
const checksum = async (path: string): Promise<string | null> =>
  (await Bun.file(path).exists())
    ? new Bun.CryptoHasher("sha256").update(await Bun.file(path).arrayBuffer()).digest("hex")
    : null;
const original = async (path: string): Promise<string | null> =>
  (await Bun.file(path).exists()) ? Bun.file(path).text() : null;

async function* files(directory: string): AsyncGenerator<string> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

export async function prepareMigrations(artifacts: string, candidates: string, output: string): Promise<void> {
  const catalog: Catalog = await Bun.file(join(artifacts, "catalog.json")).json();
  const staging = await mkdtemp(join(tmpdir(), "atlasmigration"));
  const bundle: Bundle = { version: catalog.version, artifacts: resolve(artifacts), apps: [] };
  try {
    for (const app of consumers) {
      const root = join(portfolio, app.path);
      const staged = await stageConsumer(app, staging);
      const stagedRoot = resolve(staged, relative(join(root, app.package), root));
      const changes: Change[] = [];
      const add = async (path: string, content: string | null): Promise<void> => {
        const file = join(root, path);
        const before = await checksum(file);
        if (
          content === null
            ? before !== null
            : !(await Bun.file(file).exists()) || (await Bun.file(file).text()) !== content
        ) {
          changes.push({ path, before, content });
        }
      };
      for await (const file of files(stagedRoot)) {
        const path = relative(stagedRoot, file);
        if (path === join(app.package, "package.json")) continue;
        // nested manifests have their own release process; do not strip their dependencies
        if (path.endsWith("package.json")) continue;
        if (app.name === "pluck" && path === "web/scripts/patchbilling.ts") continue;
        if (/\.[cm]?[jt]sx?$|(?:^|\/)tsconfig[^/]*\.json$/.test(path)) {
          const content = await Bun.file(file).text();
          const validated = join(candidates, app.path, path);
          if ((await Bun.file(validated).exists()) && (await Bun.file(validated).text()) !== content) {
            throw new Error(`${app.name}/${path}: current migration differs from the tested candidate`);
          }
          await add(path, content);
        }
      }
      const manifest = await Bun.file(join(candidates, app.path, app.package, "migration.json")).json();
      for (const section of ["dependencies", "devDependencies"]) {
        for (const name of Object.keys(manifest[section] ?? {})) {
          if (catalog.packages[name]) manifest[section][name] = releaseUrl(name, catalog.version);
        }
      }
      const current = await Bun.file(join(root, app.package, "package.json")).json();
      for (const section of ["dependencies", "devDependencies"]) {
        for (const name of Object.keys(current[section] ?? {})) {
          if (name === "atlas" || name.startsWith("@atlas/") || name.startsWith("@wess/atlas")) continue;
          if (!manifest[section]?.[name])
            throw new Error(`${app.name}: candidate would remove current dependency ${name}`);
        }
      }
      manifest.scripts["check:atlas"] = `${cliCommand(catalog.version)} check`;
      await add(join(app.package, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
      for (const path of new Bun.Glob("**/Dockerfile*").scanSync({ cwd: root })) {
        if (/(^|\/)(node_modules|vendor|target|\.git)(\/|$)/.test(path)) continue;
        const before = await Bun.file(join(root, path)).text();
        if (/oven\/bun:[^\s]+@sha256:/.test(before))
          throw new Error(`${app.name}/${path}: update the pinned image digest explicitly`);
        const content = before
          .replace(/(\bFROM\s+oven\/bun:)(?:latest|1(?:\.\d+){0,2})(?=[-\s]|$)/g, "$11.4.4")
          .replace(/\bbun install([^\n;&]*--production[^\n;&]*)/g, (command: string) =>
            command.includes("--omit") ? command : `${command.trimEnd()} --omit=peer`,
          );
        await add(path, content);
      }
      for (const path of new Set([
        ".tool-versions",
        ".bun-version",
        join(app.package, ".tool-versions"),
        join(app.package, ".bun-version"),
      ])) {
        const before = await original(join(root, path));
        if (before !== null)
          await add(path, path.endsWith(".bun-version") ? "1.4.4\n" : before.replace(/^bun\s+[^\n]+/m, "bun 1.4.4"));
      }
      if (app.name === "pluck") await add("web/scripts/patchbilling.ts", null);
      if (app.name === "lacey") await add("web/vendor/social.tgz", null);
      const workflow = ".github/workflows/atlaslibraries.yml";
      if (await Bun.file(join(root, workflow)).exists())
        throw new Error(`${root}/${workflow} already exists; preserve its existing workflow`);
      await add(
        workflow,
        `name: Atlas libraries\non: [push, pull_request]\npermissions:\n  contents: read\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    defaults:\n      run:\n        working-directory: ${app.package}\n    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n        with:\n          persist-credentials: false\n      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6\n        with:\n          bun-version: "1.4.4"\n      - run: bun install --frozen-lockfile --ignore-scripts\n      - run: bun run check:atlas\n      - run: bun run typecheck\n`,
      );
      bundle.apps.push({ name: app.name, root, package: app.package, changes });
    }
    await Bun.write(output, `${JSON.stringify(bundle, null, 2)}\n`);
    console.log(`Prepared ${bundle.apps.length} app migrations in ${output}`);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function verifyMigrations(path: string): Promise<void> {
  const bundle: Bundle = await Bun.file(path).json();
  const catalog: Catalog = await Bun.file(join(bundle.artifacts, "catalog.json")).json();
  if (catalog.version !== bundle.version) throw new Error("Migration/catalog version mismatch");
  // no application changes until every tested artifact is actually released
  for (const [name, pkg] of Object.entries(catalog.packages)) {
    if (!pkg.integrity || (await publishedIntegrity(name, catalog.version)) !== pkg.integrity) {
      throw new Error(`GitHub release is missing or differs from tested bytes: ${name}@${catalog.version}`);
    }
  }
  for (const app of bundle.apps) {
    if (!consumers.some((candidate) => app.root === join(portfolio, candidate.path)))
      throw new Error(`Unknown consumer root ${app.root}`);
    for (const change of app.changes) {
      const target = resolve(app.root, change.path);
      if (!target.startsWith(`${app.root}/`)) throw new Error(`Unsafe migration path ${change.path}`);
      if ((await checksum(target)) !== change.before)
        throw new Error(`Application changed since migration review: ${target}`);
    }
  }
  console.log("Published artifact integrity and migration source baselines verified; no applications changed");
}

if (import.meta.main) {
  const [command, first = "out/distribution", second = "/tmp/atlaslatest", third = "/tmp/atlasmigrations.json"] =
    Bun.argv.slice(2);
  if (command === "prepare") await prepareMigrations(first, second, third);
  else if (command === "verify") await verifyMigrations(first);
  else throw new Error("Usage: migration prepare <artifacts> <candidates> <bundle> | verify <bundle>");
}
