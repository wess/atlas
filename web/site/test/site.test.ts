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

  test("publishes Markdown alternates and the complete agent context", async () => {
    expect(await Bun.file(`${dist}/index.md`).exists()).toBe(true);
    expect(await Bun.file(`${dist}/docs/index.md`).exists()).toBe(true);

    for (const doc of docs) {
      const html = await Bun.file(`${dist}/docs/${doc.slug}/index.html`).text();
      expect(await Bun.file(`${dist}/docs/${doc.slug}/index.md`).exists()).toBe(true);
      expect(html).toContain(`rel="alternate" type="text/markdown" href="/atlas/docs/${doc.slug}/index.md"`);
      expect(html).toContain('rel="describedby" type="text/plain" href="/atlas/llms.txt"');
    }

    const full = await Bun.file(`${dist}/llms-full.txt`).text();
    expect(full.match(/<document path=/g)).toHaveLength(docs.length + 1);
    expect(full).toContain('<document path="docs/agents.md">');
    expect(full).toContain('<document path="packages/mcp/AGENTS.md">');
  });

  test("keeps every internal llms.txt link resolvable", async () => {
    const llms = await Bun.file(`${dist}/llms.txt`).text();
    const urls = [...llms.matchAll(/\(https:\/\/wess\.io(\/atlas\/[^)]+)\)/g)].map((match) => match[1]!);
    expect(urls.length).toBeGreaterThan(20);
    for (const url of urls) expect(await Bun.file(outputPath(url)).exists(), url).toBe(true);
  });

  test("keeps llms.txt concise and specification-shaped", async () => {
    const llms = await Bun.file(`${dist}/llms.txt`).text();
    expect(llms).toStartWith("# Atlas\n\n> ");
    expect(llms.length).toBeLessThan(12_000);

    const sections = llms.split(/^## /m).slice(1);
    expect(sections.length).toBeGreaterThan(2);
    for (const section of sections) {
      const lines = section.split("\n").slice(1).filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line).toStartWith("- [");
    }
  });
});
