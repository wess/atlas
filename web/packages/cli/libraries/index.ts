import { lstat, readdir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { command } from "../command/index.ts";
import { releaseVersion } from "../modules/source.ts";

const atlasLibrary = (name: string): boolean => /^@wess\/atlas(?:-|$)/.test(name);
const legacy = (name: string): boolean => name === "atlas" || name.startsWith("@atlas/");
const ignored = new Set(["node_modules", "dist", "build", "coverage", "vendor", ".git"]);

async function* sources(directory: string, prefix = ""): AsyncGenerator<string> {
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) yield* sources(directory, path);
    else if (/(?:^|\/)tsconfig[^/]*\.json$|\.[cm]?[jt]sx?$/.test(path)) yield path;
  }
}

export const checkLibraries = async (directory: string): Promise<string[]> => {
  directory = resolve(directory);
  const issues: string[] = [];
  const manifest = await Bun.file(join(directory, "package.json")).json();
  const versions = new Set<string>();
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, value] of Object.entries(manifest[section] ?? {})) {
      if (legacy(name)) issues.push(`${section}.${name}: use public @wess/atlas libraries`);
      if (!atlasLibrary(name)) continue;
      const version = typeof value === "string" ? releaseVersion(name, value) : undefined;
      if (!version) {
        issues.push(`${section}.${name}: pin an exact GitHub release artifact, not ${JSON.stringify(value)}`);
      } else versions.add(version);
      const installed = join(directory, "node_modules", name);
      try {
        if ((await lstat(installed)).isSymbolicLink()) {
          const target = await realpath(installed);
          const modules = await realpath(join(directory, "node_modules"));
          if (!target.startsWith(`${modules}/`)) issues.push(`${name}: installed link escapes node_modules`);
        }
      } catch (error) {
        if ((error as { code?: string }).code !== "ENOENT") throw error;
      }
    }
  }
  if (versions.size > 1) issues.push("Atlas facade and backing libraries must use the same version");
  const lock = Bun.file(join(directory, "bun.lock"));
  if (!(await lock.exists())) issues.push("bun.lock is required for a reproducible application install");
  else {
    const text = await lock.text();
    if (/"(?:atlas|@atlas\/[^"\n]+)"\s*:\s*\[/.test(text)) issues.push("bun.lock retains a legacy Atlas dependency");
    for (const match of text.matchAll(/"(@wess\/atlas(?:-[^"/]+)?)"\s*:\s*\[\s*"([^"\n]+)"/g)) {
      const expected = `${match[1]}@`;
      if (!match[2]!.startsWith(expected) || !releaseVersion(match[1]!, match[2]!.slice(expected.length))) {
        issues.push("bun.lock retains an Atlas source other than the pinned GitHub release");
        break;
      }
    }
  }
  for await (const path of sources(directory)) {
    const text = await Bun.file(join(directory, path)).text();
    if (/(?:from\s*|import\s*\(|require\s*\()["'](?:atlas\/|@atlas\/)/.test(text)) {
      issues.push(`${path}: legacy Atlas import`);
    }
    if (/tsconfig[^/]*\.json$/.test(path) && /"(?:atlas\/|@atlas\/|@wess\/atlas\/)[^"\n]*"\s*:/.test(text)) {
      issues.push(`${path}: remove Atlas source-layout aliases`);
    }
    if (/["'][^"'\n]*[/\\]atlas[/\\](?:web[/\\])?packages[/\\]/.test(text)) {
      issues.push(`${path}: imports an Atlas source checkout`);
    }
  }
  return issues;
};

export const checkCommand = command("check", {
  description: "Verify versioned Atlas libraries and reject local source dependencies",
  run: async () => {
    const issues = await checkLibraries(process.cwd());
    if (issues.length) {
      for (const issue of issues) console.error(issue);
      process.exitCode = 1;
    } else console.log("Atlas library dependencies verified");
  },
});
