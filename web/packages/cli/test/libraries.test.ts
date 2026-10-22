import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLibraries } from "../libraries/index.ts";
import { releaseUrl } from "../modules/source.ts";

test("library checks accept pinned GitHub releases and reject local paths, aliases, and links", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlaslibraries"));
  try {
    await Bun.write(
      join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          "@wess/atlas": releaseUrl("@wess/atlas", "0.4.0"),
          "@wess/atlas-server": releaseUrl("@wess/atlas-server", "0.4.0"),
        },
      }),
    );
    await Bun.write(
      join(root, "bun.lock"),
      JSON.stringify({
        packages: {
          "@wess/atlas": [`@wess/atlas@${releaseUrl("@wess/atlas", "0.4.0")}`, "", {}],
          "@wess/atlas-cli": [
            `@wess/atlas-cli@${releaseUrl("@wess/atlas-cli", "0.4.0")}`,
            { bin: { atlas: "./entry.ts" } },
          ],
        },
      }),
    );
    await Bun.write(join(root, "src/server.ts"), 'import { serve } from "@wess/atlas/server";');
    await Bun.write(join(root, ".cache/checkouts/old/server.ts"), 'import { serve } from "atlas/server";');
    expect(await checkLibraries(root)).toEqual([]);
    await Bun.write(join(root, "bun.lock"), '{"packages":{"atlas":["atlas@github:wess/atlas#v0.3.0", {}]}}');
    expect((await checkLibraries(root)).some((value) => value.includes("legacy Atlas dependency"))).toBe(true);
    await Bun.write(join(root, "bun.lock"), '{"packages":{"@wess/atlas":["@wess/atlas@/tmp/atlas.tgz", {}]}}');
    expect((await checkLibraries(root)).some((value) => value.includes("pinned GitHub release"))).toBe(true);
    await Bun.write(
      join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          "@wess/atlas": "file:../../atlas",
          atlas: "link:atlas",
        },
      }),
    );
    await Bun.write(
      join(root, "tsconfig.json"),
      '{"compilerOptions":{"paths":{"@wess/atlas/*":["../atlas/web/packages/*"]}}}',
    );
    await Bun.write(join(root, "src/server.ts"), 'import { serve } from "../../atlas/web/packages/server/index.ts";');
    const issues = await checkLibraries(root);
    expect(issues.some((value) => value.includes("pin an exact"))).toBe(true);
    expect(issues.some((value) => value.includes("use public"))).toBe(true);
    expect(issues.some((value) => value.includes("source-layout aliases"))).toBe(true);
    expect(issues.some((value) => value.includes("source checkout"))).toBe(true);
    await mkdir(join(root, "node_modules/@wess"), { recursive: true });
    await mkdir(join(root, "checkout"));
    await symlink(join(root, "checkout"), join(root, "node_modules/@wess/atlas"));
    expect((await checkLibraries(root)).some((value) => value.includes("escapes node_modules"))).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
