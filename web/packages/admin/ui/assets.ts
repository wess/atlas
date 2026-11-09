import { join } from "node:path";
import type { BunPlugin } from "bun";

const types: Record<string, string> = {
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
};

export type AdminAsset = { body: string; type: string };
export type AdminAssets = Record<string, AdminAsset>;

export const bundleAdmin = async (plugins: BunPlugin[]): Promise<Record<string, string>> => {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "entry.tsx")],
    target: "browser",
    minify: true,
    naming: "[name].[ext]",
    plugins,
    define: { "process.env.NODE_ENV": '"production"' },
  });
  return Object.fromEntries(
    await Promise.all(result.outputs.map(async (file) => [file.path.split("/").pop()!, await file.text()])),
  );
};

const asAssets = (files: Record<string, string>): AdminAssets =>
  Object.fromEntries(
    Object.entries(files).map(([name, body]) => [
      name,
      { body, type: types[name.split(".").pop()!] ?? "application/octet-stream" },
    ]),
  );

// a release carries the bundle, so serving admin needs neither react nor a build at runtime.
// only a source checkout reaches the build, which is also the only place the sass plugin exists.
export const loadAdminAssets = async (): Promise<AdminAssets> => {
  const prebuilt = join(import.meta.dir, "assets");
  const script = Bun.file(join(prebuilt, "entry.js"));
  if (await script.exists()) {
    const style = Bun.file(join(prebuilt, "entry.css"));
    return asAssets({ "entry.js": await script.text(), "entry.css": await style.text() });
  }
  const plugin = join(import.meta.dir, "../../../distribution/sass.ts");
  return asAssets(await bundleAdmin([(await import(plugin)).default]));
};
