import { passageMarkdown, passagePage, sectionIndex } from "./adventure.ts";
import { desktop, docs, guides, packages } from "./content.ts";
import { packageLines, packageNodes } from "./home.ts";
import { docPage, docsIndex, page } from "./layout.ts";
import { renderMarkdown, searchText } from "./markdown.ts";
import { passages, validate } from "./passages.ts";

const projectRoot = new URL("../../", import.meta.url).pathname;
const siteRoot = new URL("../", import.meta.url).pathname;
const distRoot = `${projectRoot}dist`;
const base = (Bun.env.SITE_BASE ?? "/atlas").replace(/\/$/, "") || "";
const siteOrigin = "https://wess.io/atlas";

const packageJson = (await Bun.file(`${projectRoot}package.json`).json()) as { version: string };
const version = packageJson.version;

const run = (args: readonly string[]): void => {
  const process = Bun.spawnSync([...args], { stdout: "inherit", stderr: "inherit" });
  if (process.exitCode !== 0) throw new Error(`${args[0]} failed with exit code ${process.exitCode}`);
};

const write = async (path: string, contents: string | Blob | Uint8Array): Promise<void> => {
  const target = `${distRoot}/${path}`;
  run(["mkdir", "-p", target.slice(0, target.lastIndexOf("/"))]);
  await Bun.write(target, contents);
};

validate();

run(["rm", "-rf", distRoot]);
run(["mkdir", "-p", distRoot]);

const packageSources: string[] = [];
const glob = new Bun.Glob("packages/*/AGENTS.md");
for await (const path of glob.scan({ cwd: projectRoot })) packageSources.push(path);
if (packageSources.length !== packages.length) {
  throw new Error(`site inventory has ${packages.length} packages; repository has ${packageSources.length}`);
}

const llms = await Bun.file(`${projectRoot}llms.txt`).text();
const readme = await Bun.file(`${projectRoot}README.md`).text();
const fullSources: { readonly path: string; readonly content: string }[] = [{ path: "llms.txt", content: llms }];

// The chart: the old front page, now the escape hatch for readers who do not
// want to be asked anything.
const chart = (await Bun.file(`${siteRoot}map.html`).text())
  .replaceAll("{{base}}", base)
  .replaceAll("{{version}}", version)
  .replaceAll("{{year}}", String(new Date().getFullYear()))
  .replaceAll("{{sectionCount}}", String(passages.length))
  .replace("{{packageLines}}", packageLines())
  .replace("{{packageNodes}}", packageNodes(base))
  .replace("{{sectionIndex}}", sectionIndex(base));

await write("map/index.html", chart);
await write("map/index.md", readme);

// The survey. §1 is the front door and also keeps its own number, so a link
// that says "turn to §1" lands somewhere.
for (const passage of passages) {
  const path = `/${passage.n}/`;
  await write(`${passage.n}/index.html`, passagePage(base, version, passage, path));
  await write(`${passage.n}/index.md`, passageMarkdown(passage));
  if (passage.n === 1) {
    await write("index.html", passagePage(base, version, passage, "/"));
    await write("index.md", passageMarkdown(passage));
  }
}

await write("docs/index.html", docsIndex(base, version));

const docsMarkdown = `# Atlas documentation

> Canonical guides and package references for Atlas, for both the web and desktop boilerplates.

## Guides

${guides.map((doc) => `- [${doc.title}](${siteOrigin}/docs/${doc.slug}/index.md): ${doc.description}`).join("\n")}

## Desktop

${desktop.map((doc) => `- [${doc.title}](${siteOrigin}/docs/${doc.slug}/index.md): ${doc.description}`).join("\n")}

## Package references

${packages.map((doc) => `- [${doc.title}](${siteOrigin}/docs/${doc.slug}/index.md): ${doc.description}`).join("\n")}
`;
await write("docs/index.md", docsMarkdown);

const search: { title: string; description: string; url: string; kind: string; text: string }[] = [];

for (const [index, doc] of docs.entries()) {
  const source = await Bun.file(`${projectRoot}${doc.source}`).text();
  const markdownPath = `/docs/${doc.slug}/index.md`;
  const rendered = renderMarkdown(source, base);
  const html = docPage(
    {
      base,
      version,
      title: `${doc.title} — Atlas`,
      description: doc.description,
      path: `/docs/${doc.slug}/`,
      markdownPath,
      content: "",
      doc,
      sourceUrl: `${base}${markdownPath}`,
      headings: rendered.headings,
      previous: docs[index - 1],
      next: docs[index + 1],
    },
    rendered.html,
  );
  await write(`docs/${doc.slug}/index.html`, html);
  await write(`docs/${doc.slug}/index.md`, source);
  fullSources.push({ path: doc.source, content: source });
  search.push({
    title: doc.title,
    description: doc.description,
    url: `${base}/docs/${doc.slug}/`,
    kind: "group" in doc ? "package" : "guide",
    text: searchText(source),
  });
}

for (const passage of passages) {
  search.push({
    title: `§${passage.n} · ${passage.title}`,
    description: passage.lede,
    url: `${base}/${passage.n}/`,
    kind: "station",
    text: searchText(
      [passage.lede, ...(passage.body ?? []), ...(passage.stack ?? []).map((e) => `${e.name} ${e.why}`)].join("\n"),
    ),
  });
}

const full = `# Atlas full documentation

> Complete canonical context for Atlas. Use llms.txt and individual Markdown alternates when a smaller context is sufficient.

${fullSources.map(({ path, content }) => `<document path="${path}">\n${content.trim()}\n</document>`).join("\n\n")}
`;

await Promise.all([
  write("styles.css", Bun.file(`${siteRoot}styles.css`)),
  write(
    "survey.json",
    `${JSON.stringify(passages.map((p) => ({ n: p.n, title: p.title, kind: p.kind, field: p.field })))}\n`,
  ),
  write("app.js", Bun.file(`${siteRoot}app.js`)),
  write("assets/atlas.svg", Bun.file(`${siteRoot}assets/atlas.svg`)),
  write("assets/favicon.svg", Bun.file(`${siteRoot}assets/favicon.svg`)),
  write("assets/bigshoulders.woff2", Bun.file(`${siteRoot}assets/bigshoulders.woff2`)),
  write("assets/fontlicense.txt", Bun.file(`${siteRoot}assets/fontlicense.txt`)),
  write("llms.txt", llms),
  write("llms-full.txt", full),
  write("search.json", `${JSON.stringify(search)}\n`),
  write(".nojekyll", ""),
]);

const paths = [
  "/",
  "/map/",
  ...passages.map((passage) => `/${passage.n}/`),
  "/docs/",
  ...docs.map((doc) => `/docs/${doc.slug}/`),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `  <url><loc>${siteOrigin}${path}</loc></url>`).join("\n")}
</urlset>\n`;
await write("sitemap.xml", sitemap);
await write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap.xml\n`);

await write(
  "404.html",
  page({
    base,
    version,
    title: "Lost coordinate — Atlas",
    description: "That Atlas coordinate does not exist.",
    path: "/404.html",
    bodyClass: "lost",
    content: `<main class="lostpage" id="content"><span>404 / uncharted coordinate</span><h1>There is no section here.</h1><p>The survey has ${passages.length} stations and this is not one of them. Begin again, or open the chart and go straight to what you wanted.</p><div><a class="button primary" href="${base}/">Begin at §1</a><a class="button secondary" href="${base}/map/">Open the chart</a><button class="button ghost" type="button" data-search-open>Search</button></div></main>`,
  }),
);

console.log(
  `built ${docs.length + passages.length + 4} pages in dist/ for ${base || "/"} (${passages.length} survey stations, ${docs.length} references)`,
);
