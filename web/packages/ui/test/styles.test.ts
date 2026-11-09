import { expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compile } from "sass";
import { compileStyles } from "../../../distribution/sass.ts";

const root = join(import.meta.dir, "..");
const css = compileStyles(join(root, "styles/index.scss"));
const components = readdirSync(join(root, "components"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

test("every component stylesheet is part of the compiled sheet", async () => {
  const index = await Bun.file(join(root, "styles/index.scss")).text();
  for (const name of components) {
    if (existsSync(join(root, "components", name, "index.scss"))) expect(index).toContain(`../components/${name}"`);
  }
});

test("every component has a rule, except inputs that only use the shared field", () => {
  for (const name of components) {
    if (["textinput", "numberinput"].includes(name)) continue;
    expect(css).toContain(`.atlas-${name}`);
  }
});

test("tone variants resolve for every component that declares a color", () => {
  for (const name of ["button", "actionicon", "badge", "alert"]) {
    for (const tone of ["primary", "danger", "success", "accent", "neutral"]) {
      expect(css).toContain(`.atlas-${name}[data-color=${tone}]`);
    }
  }
});

test("tokens compile to custom properties so themes can override them at runtime", () => {
  for (const token of ["--atlas-primary:", "--atlas-danger-soft:", "--atlas-space-md:", "--atlas-radius-md:"]) {
    expect(css).toContain(token);
  }
});

test("component sources export a component and the barrel exposes it", async () => {
  const barrel = await Bun.file(join(root, "components/index.tsx")).text();
  for (const name of components) {
    if (name === "field") continue;
    expect(barrel).toContain(`./${name}/index.tsx`);
  }
});

test("no source reaches for mantine", async () => {
  for (const file of new Bun.Glob("**/*.{ts,tsx,scss}").scanSync({ cwd: root })) {
    if (file.startsWith("test/") || file.includes("node_modules")) continue;
    expect(await Bun.file(join(root, file)).text()).not.toMatch(/mantine/i);
  }
});

// every readable pairing the components actually use, in every scheme and mode
const expanded = compile(join(root, "styles/index.scss")).css.replace(/,\n\s*/g, ", ");
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const palette = (selector: string) => {
  const at = expanded.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`missing palette ${selector}`);
  const block = expanded.slice(at, expanded.indexOf("}", at));
  return Object.fromEntries([...block.matchAll(/--atlas-([a-z-]+): (#[0-9a-f]{3,6})/gi)].map((m) => [m[1]!, m[2]!]));
};
const full = (hex: string) => (hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex);
const palettes: Record<string, string> = {
  "nord light": ":root:not([data-atlas-scheme]), :root[data-atlas-scheme=nord]",
  "nord dark":
    ":root:not([data-atlas-scheme])[data-atlas-mode=dark], :root[data-atlas-scheme=nord][data-atlas-mode=dark]",
  "atlas light": ":root[data-atlas-scheme=atlas]",
  "atlas dark": ":root[data-atlas-scheme=atlas][data-atlas-mode=dark]",
};

for (const [name, selector] of Object.entries(palettes)) {
  test(`${name} meets wcag aa for text`, () => {
    const p = palette(selector);
    const failures: string[] = [];
    const check = (fg: string, bg: string) => {
      const ratio = contrast(full(p[fg]!), full(p[bg]!));
      if (ratio < 4.5) failures.push(`${fg} on ${bg}: ${ratio.toFixed(2)}`);
    };
    for (const bg of ["surface", "ground", "sunken"]) {
      check("ink", bg);
      check("dimmed", bg);
    }
    for (const tone of ["primary", "danger", "success", "accent", "neutral"]) {
      check(`${tone}-contrast`, tone);
      check(tone, `${tone}-soft`);
      check(tone, "surface");
    }
    expect(failures).toEqual([]);
  });
}

test("system mode follows the os unless the document forces light", () => {
  expect(expanded).toContain("@media (prefers-color-scheme: dark)");
  expect(expanded).toContain(":root:not([data-atlas-scheme]):not([data-atlas-mode=light])");
  expect(expanded).toContain(":root[data-atlas-scheme=atlas]:not([data-atlas-mode=light])");
});
