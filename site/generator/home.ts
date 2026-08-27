import { packages } from "./content.ts";

const links: readonly (readonly [string, string])[] = [
  ["config", "db"],
  ["config", "server"],
  ["db", "migrate"],
  ["db", "auth"],
  ["db", "cache"],
  ["db", "storage"],
  ["server", "auth"],
  ["server", "request"],
  ["server", "edge"],
  ["auth", "security"],
  ["auth", "oauth"],
  ["auth", "sso"],
  ["ui", "admin"],
  ["server", "mcp"],
  ["request", "ai"],
  ["email", "share"],
  ["cli", "ui"],
  ["storage", "cli"],
];

export const packageNodes = (base: string): string =>
  packages
    .map(
      (pkg, index) =>
        `<a class="starnode" data-package data-group="${pkg.group}" href="${base}/docs/${pkg.slug}/" style="--x:${pkg.x};--y:${pkg.y};--order:${index}" aria-label="${pkg.title}: ${pkg.description}"><span></span>${pkg.slug}</a>`,
    )
    .join("\n");

export const packageLines = (): string => {
  const bySlug = new Map(packages.map((pkg) => [pkg.slug, pkg]));
  return links
    .map(([from, to]) => {
      const a = bySlug.get(from);
      const b = bySlug.get(to);
      if (!a || !b) return "";
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
    })
    .join("\n");
};
