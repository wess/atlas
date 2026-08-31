export type Heading = {
  readonly level: number;
  readonly id: string;
  readonly text: string;
};

const entities: Record<string, string> = {
  "&amp;": "&",
  "&apos;": "'",
  "&gt;": ">",
  "&lt;": "<",
  "&quot;": '"',
};

export const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const textFromHtml = (value: string): string =>
  value
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|apos|gt|lt|quot);/g, (match) => entities[match] ?? match)
    .trim();

const slugify = (value: string): string =>
  textFromHtml(value)
    .toLowerCase()
    .replace(/@wess\/atlas\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";

const resolveLink = (href: string, base: string): string => {
  if (/^(?:https?:|mailto:|#)/.test(href)) return href;
  if (href === "README.md") return `${base}/docs/readme/`;
  if (href === "llms.txt") return `${base}/llms.txt`;
  if (href === "SOUL.md") return "https://github.com/wess/atlas/blob/main/SOUL.md";

  const packageMatch = href.match(/^packages\/([^/]+)\/AGENTS\.md$/);
  if (packageMatch?.[1]) return `${base}/docs/${packageMatch[1]}/`;

  const docMatch = href.match(/(?:^|\/)docs\/([^/]+)\.md$/);
  if (docMatch?.[1]) return `${base}/docs/${docMatch[1]}/`;

  return `https://github.com/wess/atlas/blob/main/${href}`;
};

export const renderMarkdown = (
  source: string,
  base: string,
): { readonly html: string; readonly headings: readonly Heading[] } => {
  const seen = new Map<string, number>();
  const headings: Heading[] = [];
  const rendered = Bun.markdown
    .html(source)
    .replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_match, rawLevel: string, contents: string) => {
      const level = Number(rawLevel);
      const root = slugify(contents);
      const count = seen.get(root) ?? 0;
      const id = count === 0 ? root : `${root}-${count + 1}`;
      seen.set(root, count + 1);
      const text = textFromHtml(contents);
      headings.push({ level, id, text });
      return `<h${level} id="${id}">${contents}<a class="headinganchor" href="#${id}" aria-label="Link to ${escapeHtml(text)}">#</a></h${level}>`;
    });

  return {
    html: rendered.replace(/href="([^"]+)"/g, (_match, href: string) => `href="${resolveLink(href, base)}"`),
    headings,
  };
};

export const searchText = (source: string): string =>
  source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[#>*_[\]()|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
