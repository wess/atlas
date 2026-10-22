import { cp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Catalog } from "../distribution/build.ts";
import { sourceRoot } from "../distribution/config.ts";
import { releaseUrl } from "../packages/cli/modules/source.ts";
import { smokeFixture } from "./smoke.ts";
import { atlasImports } from "./stage.ts";

const run = async (cwd: string, args: string[], log: string): Promise<void> => {
  const child = Bun.spawn([process.execPath, "--no-env-file", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  await Bun.write(join(cwd, log), stdout + stderr);
  if (code !== 0) throw new Error(`${cwd}: ${args.join(" ")} failed; see ${log}`);
};

const install = async (directory: string, artifacts: string, catalog: Catalog): Promise<void> => {
  const path = join(directory, "package.json");
  const manifest = await Bun.file(path).json();
  // retain the generated GitHub release manifest for review; local tarballs are validation-only
  await Bun.write(join(directory, "release.json"), JSON.stringify(manifest, null, 2));
  for (const section of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(manifest[section] ?? {})) {
      if (!name.startsWith("@wess/atlas")) continue;
      const pkg = catalog.packages[name];
      if (!pkg?.tarball) throw new Error(`Unknown fixture library ${name}`);
      manifest[section][name] = join(artifacts, pkg.tarball);
    }
  }
  await Bun.write(path, JSON.stringify(manifest, null, 2));
  await run(directory, ["install", "--ignore-scripts"], "install.log");
};

export async function validateFixtures(artifacts: string, destination: string): Promise<void> {
  artifacts = resolve(artifacts);
  destination = resolve(destination);
  if (destination === sourceRoot || destination.startsWith(`${sourceRoot}/`)) {
    throw new Error("Fixture installs must be outside the Atlas source workspace");
  }
  const catalog: Catalog = await Bun.file(join(artifacts, "catalog.json")).json();
  const bootstrap = join(destination, "bootstrap");
  await mkdir(bootstrap, { recursive: true });
  await Bun.write(
    join(bootstrap, "package.json"),
    JSON.stringify({
      name: "fixturebootstrap",
      type: "module",
      dependencies: {
        "@wess/atlas": releaseUrl("@wess/atlas", catalog.version),
        "@wess/atlas-cli": releaseUrl("@wess/atlas-cli", catalog.version),
      },
    }),
  );
  await install(bootstrap, artifacts, catalog);
  const scaffold = await import(Bun.resolveSync("@wess/atlas/cli/scaffold", bootstrap));
  const results: { name: string; directory: string; imports: string[] }[] = [];
  const names = [...scaffold.listTemplates(), "custom", "customsqlite", "customadmin", "example"];
  for (const name of names) {
    const directory = join(destination, name);
    await mkdir(directory, { recursive: true });
    if (name === "example") {
      await cp(join(sourceRoot, "example"), directory, {
        recursive: true,
        filter: (path) => !/(^|\/)(node_modules|dist|\.env|bun\.lock|[^/]+\.db)(\/|$)/.test(path),
      });
      const manifest = await Bun.file(join(directory, "package.json")).json();
      for (const dependency of Object.keys(manifest.dependencies)) {
        if (dependency.startsWith("@atlas/")) delete manifest.dependencies[dependency];
      }
      for (const entry of await atlasImports(directory)) {
        const selection = catalog.exports[entry];
        if (!selection) throw new Error(`Unknown example import ${entry}`);
        manifest.dependencies["@wess/atlas"] = releaseUrl("@wess/atlas", catalog.version);
        for (const library of selection.packages) manifest.dependencies[library] = releaseUrl(library, catalog.version);
        Object.assign(manifest.dependencies, selection.externals);
      }
      Object.assign(manifest.devDependencies, { "@types/bun": "^1.4.3", typescript: "7.0.2" });
      await Bun.write(join(directory, "package.json"), JSON.stringify(manifest, null, 2));
      const config = scaffold
        .generateProject({ name: "example", database: "none", features: [], frontend: false })
        .find((file: { path: string }) => file.path === "tsconfig.json");
      await Bun.write(join(directory, "tsconfig.json"), config.content);
    } else if (name.startsWith("custom")) {
      const answers = {
        name,
        database: name === "custom" ? "none" : "sqlite",
        port: "0",
        frontend: false,
        features: name === "customadmin" ? ["auth", "admin"] : [],
      };
      for (const file of scaffold.generateProject(answers)) {
        await Bun.write(join(directory, file.path), file.content);
      }
    } else {
      await scaffold.scaffoldFromTemplate(name, directory, name);
    }
    await install(directory, artifacts, catalog);
    await run(directory, ["x", "--no-install", "tsc", "--noEmit"], "typecheck.log");
    if (name !== "example") await run(directory, ["run", "node_modules/.bin/atlas", "help"], "cli.log");
    if (["minimal", "custom", "customsqlite", "customadmin", "example"].includes(name)) {
      await smokeFixture(directory, name === "example", name === "customadmin");
    }
    results.push({ name, directory, imports: await atlasImports(directory) });
    await Bun.write(join(destination, "results.json"), JSON.stringify(results, null, 2));
    console.log(`${name}: packed install, typecheck${name === "example" ? "" : ", CLI"} passed`);
  }
  const production = join(destination, "production");
  await mkdir(production, { recursive: true });
  for (const path of ["package.json", "bun.lock", "server.ts"]) {
    await Bun.write(join(production, path), Bun.file(join(destination, "minimal", path)));
  }
  await run(
    production,
    ["install", "--production", "--omit=peer", "--frozen-lockfile", "--ignore-scripts"],
    "install.log",
  );
  for (const name of ["@wess/atlas-cli", "react", "zod", "typescript"]) {
    if (await Bun.file(join(production, "node_modules", name, "package.json")).exists()) {
      throw new Error(`Unexpected production dependency ${name}`);
    }
  }
  await smokeFixture(production);
  results.push({ name: "production", directory: production, imports: await atlasImports(production) });
  await Bun.write(join(destination, "results.json"), JSON.stringify(results, null, 2));
  console.log("production: frozen install excludes CLI, React, Zod, and TypeScript; HTTP passed");
}

if (import.meta.main) await validateFixtures(Bun.argv[2] ?? "out/distribution", Bun.argv[3] ?? "/tmp/atlasfixtures");
