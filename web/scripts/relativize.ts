// One-shot: rewrite cross-package `@atlas/X` imports inside packages/* to
// relative paths so atlas resolves cleanly when installed as a single git
// package (bun does not consult tsconfig paths inside node_modules).

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const PKGS = `${ROOT}packages`;

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
};

// Map "@atlas/<pkg>" and "@atlas/<pkg>/<sub>" to absolute target files.
const targetFor = (spec: string): string | null => {
  const m = spec.match(/^@atlas\/([a-z][a-z0-9]*)(?:\/(.+))?$/);
  if (!m) return null;
  const pkg = m[1]!;
  const sub = m[2];
  if (sub) {
    const tsx = `${PKGS}/${pkg}/${sub}/index.tsx`;
    const ts = `${PKGS}/${pkg}/${sub}/index.ts`;
    try { statSync(tsx); return tsx; } catch {}
    try { statSync(ts); return ts; } catch {}
    return null;
  }
  const tsx = `${PKGS}/${pkg}/index.tsx`;
  const ts = `${PKGS}/${pkg}/index.ts`;
  try { statSync(tsx); return tsx; } catch {}
  try { statSync(ts); return ts; } catch {}
  return null;
};

const SPEC_RE = /(from\s+["'])(@atlas\/[^"']+)(["'])/g;

let changed = 0;
let scanned = 0;
let unresolved = new Set<string>();

for (const file of walk(PKGS)) {
  scanned++;
  const src = readFileSync(file, "utf-8");
  const dir = dirname(file);
  let touched = false;
  const next = src.replace(SPEC_RE, (_full, lead: string, spec: string, tail: string) => {
    const target = targetFor(spec);
    if (!target) {
      unresolved.add(spec);
      return _full;
    }
    let rel = relative(dir, target);
    if (!rel.startsWith(".")) rel = `./${rel}`;
    touched = true;
    return `${lead}${rel}${tail}`;
  });
  if (touched) {
    writeFileSync(file, next);
    changed++;
  }
}

console.log(`Scanned ${scanned} files, rewrote ${changed}.`);
if (unresolved.size > 0) {
  console.log("Unresolved specs:", [...unresolved]);
}
