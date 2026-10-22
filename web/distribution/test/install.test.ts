import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BuildResult, build } from "../build.ts";
import { sourceRoot } from "../config.ts";

async function run(cwd: string, args: string[]): Promise<string> {
  const proc = Bun.spawn(["bun", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, BUN_INSTALL_CACHE_DIR: join(cwd, ".cache") },
  });
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  if (code !== 0) throw new Error(`${args.join(" ")} exited ${code}\n${stdout}\n${stderr}`);
  return stdout;
}

async function install(result: BuildResult, dir: string, names: string[]): Promise<void> {
  const dependencies = Object.fromEntries(
    names.map((name) => {
      const pkg = result.catalog.packages[name];
      if (!pkg?.tarball) throw new Error(`No tarball for ${name}`);
      return [name, join(result.outdir, pkg.tarball)];
    }),
  );
  await Bun.write(join(dir, "package.json"), JSON.stringify({ name: "consumer", type: "module", dependencies }));
  // an unreachable registry proves missing optional peers are not downloaded
  await run(dir, ["install", "--ignore-scripts", "--no-cache", "--registry", "http://127.0.0.1:1"]);
}

test("packed selective install serves HTTP without fetching optional peers", async () => {
  const root = mkdtempSync(join(tmpdir(), "atlaspacked"));
  try {
    const result = await build({ outdir: join(root, "artifacts") });
    const selected = result.mapping["./server"]!;
    expect(selected.externals).toEqual({});
    const consumer = join(root, "consumer");
    await install(result, consumer, ["@wess/atlas", ...selected.packages]);
    const installed = readdirSync(join(consumer, "node_modules/@wess")).sort();
    expect(installed).toEqual(["atlas", "atlas-server"]);
    expect(existsSync(join(consumer, "node_modules/react"))).toBe(false);
    expect(existsSync(join(consumer, "node_modules/zod"))).toBe(false);
    await Bun.write(
      join(consumer, "check.ts"),
      `
      import { get, json, router, serve } from "@wess/atlas/server";
      const handle = router(
        get("/health", c => json(c, 200, { packed: true })),
      );
      const response = await handle(new Request("http://localhost/health"));
      if (response.status !== 200 || !(await response.json()).packed) throw new Error("bad response");
      const server = serve({ port: 0, hostname: "127.0.0.1", routes: [
        get("/health", c => json(c, 200, { packed: true })),
      ] });
      try {
        const live = await fetch(new URL("/health", server.url));
        if (live.status !== 200 || !(await live.json()).packed) throw new Error("bad live response");
        console.log("packed HTTP ok");
      } finally { await server.stop(true); }
    `,
    );
    expect(await run(consumer, ["run", "check.ts"])).toContain("packed HTTP ok");
    for (const [name, pkg] of Object.entries(result.catalog.packages)) {
      const manifest = await Bun.file(join(result.outdir, pkg.directory, "package.json")).json();
      expect(manifest.version).toBe(result.catalog.version);
      expect(manifest.dependencies).toBeUndefined();
      expect(manifest.optionalDependencies).toBeUndefined();
      for (const peer of Object.keys(manifest.peerDependencies)) {
        expect(manifest.peerDependenciesMeta[peer]).toEqual({ optional: true });
      }
      expect(await Bun.file(join(result.outdir, pkg.tarball!)).exists()).toBe(true);
      if (name.startsWith("@wess/atlas-")) {
        expect(existsSync(join(result.outdir, pkg.directory, "node_modules"))).toBe(false);
      }
    }
    const cli = join(result.outdir, "atlas-cli");
    const mcp = join(result.outdir, "atlas-mcp");
    const cliCatalog = await Bun.file(join(cli, "packages/cli/modules/catalog.json")).json();
    expect(cliCatalog).toEqual({ version: result.catalog.version, exports: result.mapping });
    for (const dir of [cli, mcp]) {
      const api = await Bun.file(join(sourceRoot, "docs/api.md")).text();
      expect(await Bun.file(join(dir, "docs/api.md")).text()).toBe(api);
      expect(await Bun.file(join(dir, "packages/db/AGENTS.md")).exists()).toBe(true);
      expect(await Bun.file(join(dir, "packages/db/index.ts")).exists()).toBe(false);
    }
    expect(await Bun.file(join(cli, "templates/minimal/server.ts")).exists()).toBe(true);
    expect(await Bun.file(join(mcp, "templates/minimal/server.ts")).exists()).toBe(false);
    expect(await run(cli, ["run", "packages/cli/entry.ts", "docs", "server"])).toContain("server");
    await Bun.write(
      join(mcp, "check.ts"),
      `
      import { docsTools } from "./packages/mcp/tools/docs.ts";
      const result = await docsTools.find(t => t.name === "docs.read")!.handler({package: "server"}, {} as never);
      if (!(result as { content: string }).content.includes("server")) throw new Error("missing docs");
      console.log("mcp docs ok");
    `,
    );
    expect(await run(mcp, ["run", "check.ts"])).toContain("mcp docs ok");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 20000);
