import { type Guide, guides, packages } from "./content.ts";
import { escapeHtml, type Heading } from "./markdown.ts";

type PageOptions = {
  readonly base: string;
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly markdownPath?: string;
  readonly version: string;
  readonly bodyClass?: string;
  readonly content: string;
};

type DocPageOptions = PageOptions & {
  readonly doc: Guide;
  readonly sourceUrl: string;
  readonly headings: readonly Heading[];
  readonly previous?: Guide;
  readonly next?: Guide;
};

const directionContract = `
    <!--
    THESIS: Atlas is navigated as a constellation of composable modules, not a generic card catalog.
    OWN-WORLD: Deep Aegean fields, limestone type, cyan survey lines, magenta registration marks, square terminal controls.
    STORY: A reader identifies the system, starts correctly, then moves directly into a guide or package reference.
    FIRST VIEWPORT: A narrow product dossier faces a dominant 19-node package chart; install and primary actions stay visible.
    FORM: Aegean field terminal, grounded direction 4, seed c6104151.
    FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
    -->`;

const siteOrigin = "https://wess.io/atlas";

const icon = (name: "close" | "github" | "menu" | "search"): string => {
  if (name === "github") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.84c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>`;
  }
  if (name === "menu") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>`;
  }
  if (name === "close") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>`;
};

const current = (active: boolean, value = "page"): string => (active ? ` aria-current="${value}"` : "");

const header = (base: string, version: string, path: string): string => {
  const slug = path.match(/^\/docs\/([^/]+)\/$/)?.[1];
  const packagePage = packages.some((entry) => entry.slug === slug);
  const guidePage = guides.some((entry) => entry.slug === slug);
  return `
  <div class="utility" aria-hidden="true">
    <span>Atlas docs terminal</span>
    <span>release ${escapeHtml(version)}</span>
    <span>mode: read</span>
    <span>coord: 37°58′ N · 23°43′ E</span>
  </div>
  <header class="siteheader">
    <a class="brand" href="${base}/" aria-label="Atlas home"><span>ATLAS</span><i>docs</i></a>
    <button class="menutoggle iconbutton" type="button" data-menu aria-expanded="false" aria-controls="primarynav">
      <span class="sr" data-menu-label>Open navigation</span>${icon("menu")}
    </button>
    <nav class="primarynav" id="primarynav" aria-label="Primary navigation" data-primary-nav>
      <a href="${base}/"${current(path === "/")}>Home</a>
      <a href="${base}/docs/quickstart/"${current(slug === "quickstart")}>Start</a>
      <a href="${base}/docs/"${current(path === "/docs/")}${current(Boolean(guidePage && slug !== "quickstart" && slug !== "api"), "location")}>Guides</a>
      <a href="${base}/docs/#packages"${current(packagePage, "location")}>Packages</a>
      <a href="${base}/docs/api/"${current(slug === "api")}>API</a>
      <button class="searchbutton" type="button" data-search-open>${icon("search")}<span>Search</span><kbd>⌘K</kbd></button>
      <a class="iconlink" href="https://github.com/wess/atlas" aria-label="Atlas on GitHub">${icon("github")}</a>
    </nav>
  </header>
  <div class="greekrule" aria-hidden="true"></div>`;
};

const footer = (base: string): string => `
  <footer class="sitefooter">
    <div><strong>ATLAS</strong><span>Composable Bun/TypeScript building blocks.</span></div>
    <nav aria-label="Footer navigation">
      <a href="${base}/docs/quickstart/">Quick start</a>
      <a href="${base}/docs/api/">API</a>
      <a href="${base}/llms.txt">Agent index</a>
      <a href="https://github.com/wess/atlas">Source</a>
      <a href="https://github.com/sponsors/wess">Sponsor</a>
    </nav>
    <span>MIT · ${new Date().getFullYear()}</span>
  </footer>`;

const search = (base: string): string => `
  <dialog class="searchdialog" data-search-dialog data-base="${base}" aria-labelledby="searchheading">
    <form method="dialog" class="searchhead">
      <label id="searchheading" for="sitesearch">Search the field guide</label>
      <button class="iconbutton" type="submit" value="cancel" aria-label="Close search">${icon("close")}</button>
    </form>
    <input id="sitesearch" type="search" autocomplete="off" placeholder="Package, export, or concept…" data-search-input />
    <div class="searchstatus" aria-live="polite" data-search-status>Type to search guides and package references.</div>
    <ol class="searchresults" data-search-results></ol>
  </dialog>`;

export const page = (options: PageOptions): string => {
  const markdownPath = options.markdownPath ?? (options.path.endsWith("/") ? `${options.path}index.md` : undefined);
  const alternate = markdownPath
    ? `<link rel="alternate" type="text/markdown" href="${options.base}${markdownPath}" />`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000818" />
    <meta name="description" content="${escapeHtml(options.description)}" />
    <meta property="og:title" content="${escapeHtml(options.title)}" />
    <meta property="og:description" content="${escapeHtml(options.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${siteOrigin}${options.path}" />
    <link rel="canonical" href="${siteOrigin}${options.path}" />
    ${alternate}
    <link rel="describedby" type="text/plain" href="${options.base}/llms.txt" />
    <link rel="icon" href="${options.base}/assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="${options.base}/styles.css" />
    <title>${escapeHtml(options.title)}</title>
  </head>
  <body class="${options.bodyClass ?? ""}">${directionContract}
    <a class="skip" href="#content">Skip to content</a>
    ${header(options.base, options.version, options.path)}
    ${options.content}
    ${footer(options.base)}
    ${search(options.base)}
    <script src="${options.base}/app.js"></script>
  </body>
</html>`;
};

const navLink = (base: string, doc: Guide, active: string): string =>
  `<a href="${base}/docs/${doc.slug}/"${doc.slug === active ? ' aria-current="page"' : ""}><span>${escapeHtml(doc.title)}</span></a>`;

const docNavigation = (base: string, active: string): string => `
  <aside class="docnav" aria-label="Documentation navigation" data-doc-nav>
    <a class="docnavhome" href="${base}/docs/">Field guide index</a>
    <strong>Guides</strong>
    ${guides.map((doc) => navLink(base, doc, active)).join("\n")}
    <strong>Packages</strong>
    ${packages.map((doc) => navLink(base, doc, active)).join("\n")}
  </aside>`;

const tableOfContents = (headings: readonly Heading[]): string => {
  const links = headings
    .filter((heading) => heading.level === 2 || heading.level === 3)
    .map((heading) => `<a href="#${heading.id}" class="toclevel${heading.level}">${escapeHtml(heading.text)}</a>`)
    .join("\n");
  return `<aside class="toc" aria-label="On this page"><strong>On this page</strong>${links || "<span>No subsections</span>"}</aside>`;
};

const pagerLink = (base: string, label: string, doc?: Guide): string =>
  doc
    ? `<a href="${base}/docs/${doc.slug}/"><span>${label}</span><strong>${escapeHtml(doc.title)}</strong></a>`
    : "<span></span>";

export const docPage = (options: DocPageOptions, article: string): string =>
  page({
    ...options,
    bodyClass: "docs",
    content: `
      <div class="docshell">
        ${docNavigation(options.base, options.doc.slug)}
        <main class="article" id="content">
          <div class="breadcrumb"><a href="${options.base}/docs/">Field guide</a><span>/</span><span>${escapeHtml(options.doc.title)}</span></div>
          <article>${article}</article>
          <div class="sourcebar"><span>Canonical source</span><a href="${options.sourceUrl}">${escapeHtml(options.doc.source)}</a></div>
          <nav class="pager" aria-label="Adjacent documentation">
            ${pagerLink(options.base, "Previous", options.previous)}
            ${pagerLink(options.base, "Next", options.next)}
          </nav>
        </main>
        ${tableOfContents(options.headings)}
      </div>`,
  });

const guideRows = (base: string): string =>
  guides
    .map(
      (guide) => `<a class="indexrow" href="${base}/docs/${guide.slug}/">
        <span>${escapeHtml(guide.title)}</span><p>${escapeHtml(guide.description)}</p><i>Open guide</i>
      </a>`,
    )
    .join("\n");

const packageRows = (base: string): string =>
  packages
    .map(
      (pkg) => `<a class="packagerow" href="${base}/docs/${pkg.slug}/">
        <code>${escapeHtml(pkg.title)}</code><span>${escapeHtml(pkg.description)}</span><i>${pkg.group}</i>
      </a>`,
    )
    .join("\n");

export const docsIndex = (base: string, version: string): string =>
  page({
    base,
    version,
    title: "Atlas field guide",
    description: "Guides and package references for Atlas, composable Bun/TypeScript building blocks.",
    path: "/docs/",
    bodyClass: "docs docsindex",
    content: `
      <main class="fieldguide" id="content">
        <header class="guideintro">
          <h1>Field guide</h1>
          <p>Start with a working route, inspect the architecture when it matters, then open the exact package reference beside your editor.</p>
          <div class="guideactions">
            <a class="button primary" href="${base}/docs/quickstart/">Start building</a>
            <button class="button secondary" type="button" data-search-open>Search all docs</button>
          </div>
        </header>
        <section class="guideindex" aria-labelledby="guideheading">
          <h2 id="guideheading">Guides</h2>
          ${guideRows(base)}
        </section>
        <section class="packageindex" id="packages" aria-labelledby="packageheading">
          <div><h2 id="packageheading">Package manifest</h2><p>Nineteen root exports. Each reference is generated from its canonical <code>AGENTS.md</code>.</p></div>
          <div class="packagefilter"><label for="packagefilter">Filter packages</label><input id="packagefilter" type="search" placeholder="auth, storage, routes…" data-package-filter /></div>
          <div data-package-list>${packageRows(base)}</div>
          <p class="emptystate" hidden data-package-empty>No packages match that filter. Clear the field to restore the manifest.</p>
        </section>
      </main>`,
  });
