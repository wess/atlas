import { beforeAll, describe, expect, test } from "bun:test";
import { docs, packages } from "../generator/content.ts";

const root = new URL("../../", import.meta.url).pathname;
const dist = `${root}dist`;

beforeAll(async () => {
  await import("../generator/index.ts");
});

const outputPath = (url: string): string => {
  const clean = url.replace(/^\/atlas/, "").split(/[?#]/)[0] ?? "";
  return clean === "" || clean.endsWith("/") ? `${dist}${clean}/index.html`.replace("//", "/") : `${dist}${clean}`;
};

describe("documentation site", () => {
  test("builds every guide and package reference", async () => {
    expect(packages).toHaveLength(19);
    for (const doc of docs) expect(await Bun.file(`${dist}/docs/${doc.slug}/index.html`).exists()).toBe(true);
  });

  test("emits the design contract without template placeholders", async () => {
    const home = await Bun.file(`${dist}/index.html`).text();
    expect(home).toContain("seed c6104151");
    expect(home).not.toContain("{{");
    expect(home.match(/class="starnode"/g)).toHaveLength(packages.length);
  });

  test("keeps internal page and asset links resolvable", async () => {
    const glob = new Bun.Glob("**/*.html");
    for await (const path of glob.scan({ cwd: dist })) {
      const html = await Bun.file(`${dist}/${path}`).text();
      const urls = [...html.matchAll(/(?:href|src)="(\/atlas\/[^"\s]+)"/g)].map((match) => match[1]!);
      for (const url of urls) expect(await Bun.file(outputPath(url)).exists(), `${path}: ${url}`).toBe(true);
    }
  });

  test("indexes every generated documentation page", async () => {
    const search = (await Bun.file(`${dist}/search.json`).json()) as unknown[];
    expect(search).toHaveLength(docs.length);
  });
});
