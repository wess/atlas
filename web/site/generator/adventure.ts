// Rendering the field survey.
//
// One HTML page per section, at `/<n>/`. That is the whole reason this is a
// gamebook and not a wizard: "turn to §47" has to be a place you can link
// someone to, bookmark, and land on cold from a search result. A single-page
// app with the state in memory gets none of that.
//
// Nothing here needs JavaScript. `app.js` adds the route trail and the number
// keys on top; without it every choice is still a link and every page still
// says everything it has to say.

import { page } from "./layout.ts";
import { escapeHtml } from "./markdown.ts";
import { type Choice, onward, type Passage, passages } from "./passages.ts";

const fieldLabel: Record<Passage["field"], string> = {
  open: "Atlas field survey",
  web: "Web field",
  desktop: "Desktop field",
  both: "Both fields",
};

const kindLabel: Record<Passage["kind"], string> = {
  fork: "Fork",
  ending: "Plate",
  appendix: "Appendix",
};

/** Section numbers read as two digits, the way a gamebook prints them. */
export const sectionLabel = (n: number): string => String(n).padStart(2, "0");

const href = (base: string, to: number | string): string =>
  typeof to === "number" ? `${base}/${to}/` : `${base}${to}`;

const marker = (to: number | string): string => (typeof to === "number" ? `§${to}` : "→");

const choiceItem = (base: string, choice: Choice, index: number): string => {
  const note = choice.note ? `<small>${escapeHtml(choice.note)}</small>` : "";
  return `<li>
        <a href="${href(base, choice.to)}" data-choice="${index + 1}">
          <b aria-hidden="true">${index + 1}</b>
          <span>${escapeHtml(choice.label)}${note}</span>
          <i aria-hidden="true"></i>
          <em>${marker(choice.to)}</em>
        </a>
      </li>`;
};

const choiceList = (base: string, choices: readonly Choice[], heading: string): string => {
  if (choices.length === 0) return "";
  return `<nav class="choices" aria-label="${escapeHtml(heading)}">
      <h2>${escapeHtml(heading)}</h2>
      <ol>
        ${choices.map((choice, index) => choiceItem(base, choice, index)).join("\n")}
      </ol>
    </nav>`;
};

const stack = (base: string, passage: Passage): string => {
  if (!passage.stack) return "";
  const rows = passage.stack
    .map((entry) => {
      const name = entry.slug
        ? `<a href="${base}/docs/${entry.slug}/"><code>${escapeHtml(entry.name)}</code></a>`
        : `<code>${escapeHtml(entry.name)}</code>`;
      return `<div class="stackrow">${name}<p>${escapeHtml(entry.why)}</p></div>`;
    })
    .join("\n");
  return `<section class="stack" aria-labelledby="stackheading">
      <h2 id="stackheading">What you are carrying</h2>
      ${rows}
    </section>`;
};

const command = (passage: Passage): string => {
  if (!passage.command) return "";
  return `<section class="command" aria-labelledby="commandheading">
      <h2 id="commandheading">Start it</h2>
      <div class="commandline">
        <code>${escapeHtml(passage.command)}</code>
        <button class="button ghost" type="button" data-copy="${escapeHtml(passage.command)}">Copy</button>
      </div>
    </section>`;
};

const snippet = (passage: Passage): string => {
  if (!passage.snippet) return "";
  const { file, language, source } = passage.snippet;
  return `<section class="snippet" aria-labelledby="snippetheading">
      <h2 id="snippetheading">What it looks like</h2>
      <figure>
        <figcaption><span>${escapeHtml(file)}</span><i>${escapeHtml(language)}</i></figcaption>
        <pre><code class="language-${escapeHtml(language)}">${escapeHtml(source)}</code></pre>
      </figure>
    </section>`;
};

const reading = (base: string, passage: Passage): string => {
  if (!passage.reading || passage.reading.length === 0) return "";
  const links = passage.reading
    .map((entry) => {
      const target = entry.slug.startsWith("http") ? entry.slug : `${base}/docs/${entry.slug}/`;
      return `<a href="${target}">${escapeHtml(entry.title)}</a>`;
    })
    .join("\n");
  return `<section class="reading" aria-labelledby="readingheading">
      <h2 id="readingheading">Read next</h2>
      <div>${links}</div>
    </section>`;
};

const bodyParagraphs = (passage: Passage): string =>
  (passage.body ?? []).map((text) => `<p>${inlineCode(escapeHtml(text))}</p>`).join("\n");

/**
 * Backticks and bold survive into the prose. The passages are written as text,
 * not Markdown, so this is deliberately two rules rather than a parser — the
 * moment it needs a third, the content belongs in a `.md` file instead.
 */
const inlineCode = (text: string): string =>
  text.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

export const passagePage = (base: string, version: string, passage: Passage, path: string): string => {
  const number = sectionLabel(passage.n);
  const isEnding = passage.kind === "ending";
  const heading = passage.plate ?? `Section ${passage.n}`;

  const choices = passage.choices ?? [];
  const onwardChoices = onward(passage);

  const content = `
      <main class="survey" id="content">
        <div class="stationhead">
          <span class="field field-${passage.field}">${escapeHtml(fieldLabel[passage.field])}</span>
          <span>${escapeHtml(kindLabel[passage.kind])} ${passage.n}</span>
          <span class="routetrail" data-route-trail><i>Route</i> <b data-route-list>§${passage.n}</b></span>
        </div>
        <article class="station${isEnding ? " isending" : ""}" data-section="${passage.n}">
          <header>
            <span class="stationkind">${escapeHtml(heading)}</span>
            <p class="stationnumber" aria-hidden="true">${number}</p>
            <h1>${escapeHtml(passage.title)}</h1>
            <p class="lede">${inlineCode(escapeHtml(passage.lede))}</p>
          </header>
          ${passage.body ? `<div class="stationbody">${bodyParagraphs(passage)}</div>` : ""}
          ${stack(base, passage)}
          ${command(passage)}
          ${snippet(passage)}
          ${reading(base, passage)}
          ${choiceList(base, choices, isEnding ? "Where now" : "Choose")}
          ${choiceList(base, onwardChoices, "Where now")}
          <div class="stationfoot">
            <a href="${base}/">Begin again at §1</a>
            <a href="${base}/map/">The whole chart</a>
            <button class="button ghost" type="button" data-route-clear hidden>Forget my route</button>
          </div>
        </article>
      </main>`;

  return page({
    base,
    version,
    title: `§${passage.n} ${passage.title} — Atlas`,
    description: passage.lede,
    path,
    bodyClass: `survey field-${passage.field}${isEnding ? " ending" : ""}`,
    markdownPath: `/${passage.n}/index.md`,
    content,
  });
};

/** The plain-text alternate every page on this site advertises. */
export const passageMarkdown = (passage: Passage): string => {
  const lines: string[] = [`# §${passage.n} — ${passage.title}`, "", passage.lede, ""];
  for (const paragraph of passage.body ?? []) lines.push(paragraph, "");

  if (passage.stack) {
    lines.push("## What you are carrying", "");
    for (const entry of passage.stack) lines.push(`- \`${entry.name}\` — ${entry.why}`);
    lines.push("");
  }
  if (passage.command) lines.push("## Start it", "", "```bash", passage.command, "```", "");
  if (passage.snippet) {
    lines.push(
      "## What it looks like",
      "",
      `\`${passage.snippet.file}\``,
      "",
      "```" + passage.snippet.language,
      passage.snippet.source,
      "```",
      "",
    );
  }
  const choices = [...(passage.choices ?? []), ...onward(passage)];
  if (choices.length > 0) {
    lines.push("## Where now", "");
    for (const choice of choices) {
      const target = typeof choice.to === "number" ? `turn to §${choice.to}` : choice.to;
      lines.push(`- ${choice.label} — ${target}${choice.note ? ` (${choice.note})` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
};

/** The full section list, for the chart page and the sitemap. */
export const sectionIndex = (base: string): string => {
  const rows = [...passages]
    .sort((a, b) => a.n - b.n)
    .map(
      (passage) =>
        `<a class="sectionrow" href="${base}/${passage.n}/">
          <b>${sectionLabel(passage.n)}</b>
          <span>${escapeHtml(passage.title)}</span>
          <i class="field-${passage.field}">${escapeHtml(kindLabel[passage.kind])}</i>
        </a>`,
    )
    .join("\n");
  return `<section class="sectionindex" id="sections" aria-labelledby="sectionsheading">
      <div>
        <h2 id="sectionsheading">Every station</h2>
        <p>The survey has ${passages.length} sections. Reading them in order spoils the walk, which is the only reason they are numbered out of it.</p>
      </div>
      <div class="sectionlist">${rows}</div>
    </section>`;
};
