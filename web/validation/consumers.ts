import { join, resolve } from "node:path";
import type { Catalog } from "../distribution/build.ts";
import { releaseUrl } from "../packages/cli/modules/source.ts";
import { consumers } from "./apps.ts";
import { atlasImports, stageConsumer } from "./stage.ts";

type Result = {
  app: string;
  directory: string;
  imports: string[];
  libraries: string[];
  install?: number;
  update?: number;
  audit?: number;
  typecheck?: number;
};

const run = async (cwd: string, args: string[], log: string): Promise<number> => {
  const child = Bun.spawn([process.execPath, "--no-env-file", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  await Bun.write(log, stdout + stderr);
  return code;
};

export async function validateConsumers(options: {
  artifacts: string;
  destination: string;
  names?: string[];
  install?: boolean;
  upgrade?: boolean;
}): Promise<Result[]> {
  const catalog: Catalog = await Bun.file(join(options.artifacts, "catalog.json")).json();
  const results: Result[] = [];
  for (const app of consumers.filter((app) => !options.names?.length || options.names.includes(app.name))) {
    const directory = await stageConsumer(app, options.destination);
    const imports = await atlasImports(directory);
    const libraries = new Set<string>([catalog.facade]);
    const externals: Record<string, string> = {};
    for (const name of imports) {
      const selection = catalog.exports[name];
      if (!selection) throw new Error(`${app.name}: unsupported Atlas import ${name}`);
      for (const library of selection.packages) libraries.add(library);
      Object.assign(externals, selection.externals);
    }
    const path = join(directory, "package.json");
    const manifest = await Bun.file(path).json();
    const dependencies = { ...manifest.dependencies, ...externals };
    for (const library of libraries) dependencies[library] = releaseUrl(library, catalog.version);
    const intended = { ...manifest, dependencies };
    await Bun.write(join(directory, "migration.json"), `${JSON.stringify(intended, null, 2)}\n`);
    // candidate tarballs validate the release contents before GitHub publication
    for (const library of libraries) {
      const tarball = catalog.packages[library]?.tarball;
      if (!tarball) throw new Error(`Missing packed library ${library}`);
      dependencies[library] = join(resolve(options.artifacts), tarball);
    }
    await Bun.write(path, `${JSON.stringify({ ...manifest, dependencies }, null, 2)}\n`);
    const result: Result = { app: app.name, directory, imports, libraries: [...libraries].sort() };
    if (options.install !== false) {
      result.install = await run(directory, ["install", "--ignore-scripts"], join(directory, "install.log"));
      if (result.install === 0) {
        if (options.upgrade) {
          result.update = await run(
            directory,
            ["update", "--latest", "--ignore-scripts"],
            join(directory, "update.log"),
          );
        }
        result.typecheck = await run(directory, ["run", "typecheck"], join(directory, "typecheck.log"));
        result.audit = await run(directory, ["audit", "--json"], join(directory, "audit.json"));
      }
    }
    const updated = await Bun.file(path).json();
    for (const library of libraries) updated.dependencies[library] = releaseUrl(library, catalog.version);
    updated.engines = { ...updated.engines, bun: ">=1.4.4" };
    await Bun.write(join(directory, "migration.json"), `${JSON.stringify(updated, null, 2)}\n`);
    results.push(result);
    console.log(
      `${app.name}: install=${result.install ?? "skipped"} update=${result.update ?? "skipped"} typecheck=${result.typecheck ?? "skipped"} audit=${result.audit ?? "skipped"}`,
    );
    await Bun.write(join(options.destination, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  }
  return results;
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  const artifacts = resolve(args[0] ?? "out/distribution");
  const destination = resolve(args[1] ?? "/tmp/atlasconsumers");
  const results = await validateConsumers({
    artifacts,
    destination,
    names: args.slice(2).filter((name) => !name.startsWith("--")),
    upgrade: args.includes("--upgrade"),
  });
  if (
    results.some(
      (result) =>
        result.install !== 0 ||
        result.typecheck !== 0 ||
        result.audit !== 0 ||
        (result.update !== undefined && result.update !== 0),
    )
  )
    process.exitCode = 1;
}
