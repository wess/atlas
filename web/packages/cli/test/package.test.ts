import { expect, test } from "bun:test";
import { resolve } from "node:path";

const web = resolve(import.meta.dir, "../../..");
const root = resolve(web, "..");

test("source manifests expose the same Atlas development release", async () => {
  const source = await Bun.file(`${web}/package.json`).json();
  const github = await Bun.file(`${root}/package.json`).json();
  expect(github.name).toBe(source.name);
  expect(github.version).toBe(source.version);
  expect(github.dependencies).toEqual(source.dependencies);
  expect(github.peerDependencies).toEqual(source.peerDependencies);
  expect(github.peerDependenciesMeta).toEqual(source.peerDependenciesMeta);
  expect(github.files).toEqual(source.files.map((path: string) => `web/${path}`));
  expect(github.exports).toEqual(
    Object.fromEntries(
      Object.entries(source.exports).map(([name, path]) => [name, String(path).replace("./", "./web/")]),
    ),
  );
  expect(github.bin.atlas).toBe(source.bin.atlas.replace("./", "./web/"));
  expect(source.files).toContain("templates");
  for (const path of Object.values(source.exports)) {
    if (String(path).includes("*")) continue;
    expect(await Bun.file(resolve(web, String(path))).exists()).toBe(true);
  }
});
