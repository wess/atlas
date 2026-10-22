import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../build.ts";

test("a production UI leaf renders with required peers and no unrelated blocks", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlasui"));
  const run = async (cwd: string, args: string[]): Promise<string> => {
    const child = Bun.spawn([process.execPath, "--no-env-file", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
    const [code, out, err] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    if (code !== 0) throw new Error(`${args.join(" ")}: ${out}\n${err}`);
    return out;
  };
  try {
    const result = await build({ outdir: join(root, "artifacts") });
    const dependencies: Record<string, string> = { ...result.mapping["./ui/provider"]!.externals };
    for (const name of ["@wess/atlas", ...result.mapping["./ui/provider"]!.packages])
      dependencies[name] = join(result.outdir, result.catalog.packages[name]!.tarball!);
    const manifest = JSON.stringify({ name: "uileaf", type: "module", dependencies });
    const development = join(root, "development");
    const production = join(root, "production");
    await mkdir(development);
    await mkdir(production);
    await Bun.write(join(development, "package.json"), manifest);
    await run(development, ["install", "--ignore-scripts"]);
    await Bun.write(join(production, "package.json"), manifest);
    await Bun.write(join(production, "bun.lock"), Bun.file(join(development, "bun.lock")));
    await run(production, ["install", "--frozen-lockfile", "--production", "--omit=peer", "--ignore-scripts"]);
    await Bun.write(
      join(production, "check.tsx"),
      `
      import { renderToStaticMarkup } from "react-dom/server";
      import { AtlasProvider } from "@wess/atlas/ui/provider";
      const html = renderToStaticMarkup(<AtlasProvider><span>production UI</span></AtlasProvider>);
      if (!html.includes("production UI")) throw new Error("render failed");
      console.log("production UI rendered");
    `,
    );
    expect(await run(production, ["run", "check.tsx"])).toContain("production UI rendered");
    for (const name of ["@mantine/hooks", "react-dom"])
      expect(await Bun.file(join(production, "node_modules", name, "package.json")).exists()).toBe(true);
    for (const name of ["@mantine/form", "@tanstack/react-table", "zod", "@wess/atlas-db"])
      expect(await Bun.file(join(production, "node_modules", name, "package.json")).exists()).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
