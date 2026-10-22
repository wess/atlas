import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { build } from "../build.ts";

test("HTTP release tarballs support canonical imports and the CLI without an Atlas registry", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlastransport"));
  const result = await build({ outdir: join(root, "artifacts") });
  const assets = new Set(Object.values(result.catalog.packages).map((pkg) => pkg.tarball));
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const name = basename(new URL(request.url).pathname);
      return assets.has(name) ? new Response(Bun.file(join(result.outdir, name))) : new Response(null, { status: 404 });
    },
  });
  const run = async (args: string[]): Promise<string> => {
    const child = Bun.spawn([process.execPath, "--no-env-file", ...args], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, BUN_INSTALL_CACHE_DIR: join(root, ".cache"), NPM_CONFIG_REGISTRY: "http://127.0.0.1:1" },
    });
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    if (code !== 0) throw new Error(`${args.join(" ")} failed: ${stdout}\n${stderr}`);
    return stdout;
  };
  try {
    const asset = (name: string) =>
      new URL(`v${result.catalog.version}/${result.catalog.packages[name]!.tarball}`, server.url).href;
    await Bun.write(
      join(root, "package.json"),
      JSON.stringify({
        name: "transport",
        type: "module",
        dependencies: {
          "@wess/atlas": asset("@wess/atlas"),
          "@wess/atlas-server": asset("@wess/atlas-server"),
        },
      }),
    );
    await run(["install", "--ignore-scripts", "--no-cache"]);
    await Bun.write(
      join(root, "check.ts"),
      'import { get, json, router } from "@wess/atlas/server"; const response = await router(get("/", c => json(c, 200, {ok:true})))(new Request("http://localhost/")); if(response.status !== 200 || !(await response.json()).ok) throw new Error("HTTP artifact import failed"); console.log("HTTP library ok");',
    );
    expect(await run(["run", "check.ts"])).toContain("HTTP library ok");
    expect(await Bun.file(join(root, "node_modules/react/package.json")).exists()).toBe(false);
    expect(await Bun.file(join(root, "node_modules/zod/package.json")).exists()).toBe(false);
    expect(await run(["x", "--package", asset("@wess/atlas-cli"), "atlas", "add"])).toContain("Available:");
  } finally {
    await server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
