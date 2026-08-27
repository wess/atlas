import { docs, packages } from "./content.ts";
import { packageLines, packageNodes } from "./home.ts";
import { docPage, docsIndex, page } from "./layout.ts";
import { renderMarkdown, searchText } from "./markdown.ts";

const projectRoot = new URL("../../", import.meta.url).pathname;
const siteRoot = new URL("../", import.meta.url).pathname;
const distRoot = `${projectRoot}dist`;
const base = (Bun.env.SITE_BASE ?? "/atlas").replace(/\/$/, "") || "";
const repo = "https://github.com/wess/atlas";

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

run(["rm", "-rf", distRoot]);
run(["mkdir", "-p", distRoot]);

const packageSources: string[] = [];
const glob = new Bun.Glob("packages/*/AGENTS.md");
for await (const path of glob.scan({ cwd: projectRoot })) packageSources.push(path);
if (packageSources.length !== packages.length) {
  throw new Error(`site inventory has ${packages.length} packages; repository has ${packageSources.length}`);
}

const home = (await Bun.file(`${siteRoot}index.html`).text())
  .replaceAll("{{base}}", base)
  .replaceAll("{{version}}", version)
  .replaceAll("{{year}}", String(new Date().getFullYear()))
  .replace("{{packageLines}}", packageLines())
  .replace("{{packageNodes}}", packageNodes(base));

await write("index.html", home);
await write("docs/index.html", docsIndex(base, version));

const search: { title: string; description: string; url: string; kind: string; text: string }[] = [];

for (const [index, doc] of docs.entries()) {
  const source = await Bun.file(`${projectRoot}${doc.source}`).text();
  const rendered = renderMarkdown(source, base);
  const html = docPage(
    {
      base,
      version,
      title: `${doc.title} — Atlas`,
      description: doc.description,
      path: `/docs/${doc.slug}/`,
      content: "",
      doc,
      sourceUrl: `${repo}/blob/main/${doc.source}`,
      headings: rendered.headings,
      previous: docs[index - 1],
      next: docs[index + 1],
    },
    rendered.html,
  );
  await write(`docs/${doc.slug}/index.html`, html);
  search.push({
    title: doc.title,
    description: doc.description,
    url: `${base}/docs/${doc.slug}/`,
    kind: "group" in doc ? "package" : "guide",
    text: searchText(source),
  });
}

await Promise.all([
  write("styles.css", Bun.file(`${siteRoot}styles.css`)),
  write("app.js", Bun.file(`${siteRoot}app.js`)),
  write("assets/atlas.svg", Bun.file(`${siteRoot}assets/atlas.svg`)),
  write("assets/favicon.svg", Bun.file(`${siteRoot}assets/favicon.svg`)),
  write("assets/bigshoulders.woff2", Bun.file(`${siteRoot}assets/bigshoulders.woff2`)),
  write("assets/fontlicense.txt", Bun.file(`${siteRoot}assets/fontlicense.txt`)),
  write("llms.txt", Bun.file(`${projectRoot}llms.txt`)),
  write("search.json", `${JSON.stringify(search)}\n`),
  write(".nojekyll", ""),
]);

const paths = ["/", "/docs/", ...docs.map((doc) => `/docs/${doc.slug}/`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `  <url><loc>https://wess.github.io/atlas${path}</loc></url>`).join("\n")}
</urlset>\n`;
await write("sitemap.xml", sitemap);
await write("robots.txt", "User-agent: *\nAllow: /\nSitemap: https://wess.github.io/atlas/sitemap.xml\n");

await write(
  "404.html",
  page({
    base,
    version,
    title: "Lost coordinate — Atlas",
    description: "That Atlas documentation coordinate does not exist.",
    path: "/404.html",
    bodyClass: "lost",
    content: `<main class="lostpage" id="content"><span>404 / uncharted coordinate</span><h1>Nothing is mapped here.</h1><p>Return to the field guide or search the package constellation.</p><div><a class="button primary" href="${base}/docs/">Open field guide</a><button class="button secondary" type="button" data-search-open>Search docs</button></div></main>`,
  }),
);

console.log(`built ${docs.length + 3} pages in dist/ for ${base || "/"}`);
