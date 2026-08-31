import { beforeAll, describe, expect, test } from "bun:test";
import { docs, packages } from "../generator/content.ts";
import { onward, passages } from "../generator/passages.ts";

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
    // The constellation lives on the chart now; the front door is §1.
    const chart = await Bun.file(`${dist}/map/index.html`).text();
    expect(chart).toContain("seed c6104151");
    expect(chart).not.toContain("{{");
    expect(chart.match(/class="starnode"/g)).toHaveLength(packages.length);

    const home = await Bun.file(`${dist}/index.html`).text();
    expect(home).not.toContain("{{");
  });

  test("builds every survey station, and opens on the first one", async () => {
    for (const passage of passages) {
      expect(await Bun.file(`${dist}/${passage.n}/index.html`).exists(), `§${passage.n}`).toBe(true);
      expect(await Bun.file(`${dist}/${passage.n}/index.md`).exists(), `§${passage.n}.md`).toBe(true);
    }

    // `/` and `/1/` are the same section, so a link that says "turn to §1"
    // and the front door agree.
    const front = await Bun.file(`${dist}/index.html`).text();
    expect(front).toContain('data-section="1"');
    expect(front).toContain("You are about to build something");
  });

  test("gives every station somewhere to go", async () => {
    // `validate()` proves this over the data at build time; this proves it
    // survived into the HTML, which is what a reader actually gets.
    for (const passage of passages) {
      const html = await Bun.file(`${dist}/${passage.n}/index.html`).text();
      const links = [...html.matchAll(/class="choices"[\s\S]*?<\/nav>/g)].join("");
      const outgoing = [...(passage.choices ?? []), ...onward(passage)];
      expect(outgoing.length, `§${passage.n} has no exits`).toBeGreaterThan(0);
      for (const choice of outgoing) {
        const target = typeof choice.to === "number" ? `/atlas/${choice.to}/` : `/atlas${choice.to}`;
        expect(links, `§${passage.n} → ${choice.to}`).toContain(`href="${target}"`);
      }
    }
  });

  test("keeps internal page and asset links resolvable", async () => {
    const glob = new Bun.Glob("**/*.html");
    for await (const path of glob.scan({ cwd: dist })) {
      const html = await Bun.file(`${dist}/${path}`).text();
      const urls = [...html.matchAll(/(?:href|src)="(\/atlas\/[^"\s]+)"/g)].map((match) => match[1]!);
      for (const url of urls) expect(await Bun.file(outputPath(url)).exists(), `${path}: ${url}`).toBe(true);
    }
  });

  test("indexes every documentation page and every station", async () => {
    const search = (await Bun.file(`${dist}/search.json`).json()) as { kind: string }[];
    expect(search).toHaveLength(docs.length + passages.length);
    expect(search.filter((entry) => entry.kind === "station")).toHaveLength(passages.length);
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
