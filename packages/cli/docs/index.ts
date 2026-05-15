import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { command } from "../command/index.ts";

// Walk up from this file to find Atlas's packages/ directory.
//   packages/cli/docs/index.ts → ../../packages/
const ATLAS_ROOT = new URL("../../../", import.meta.url).pathname;
const PACKAGES_DIR = `${ATLAS_ROOT}packages`;
const DOCS_DIR = `${ATLAS_ROOT}docs`;

const listPackages = (): string[] => {
  if (!existsSync(PACKAGES_DIR)) return [];
  return readdirSync(PACKAGES_DIR)
    .filter((name) => {
      const stat = statSync(`${PACKAGES_DIR}/${name}`, { throwIfNoEntry: false });
      return stat?.isDirectory() && existsSync(`${PACKAGES_DIR}/${name}/AGENTS.md`);
    })
    .sort();
};

const listDocs = (): string[] => {
  if (!existsSync(DOCS_DIR)) return [];
  return readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();
};

const printIndex = (): void => {
  const packages = listPackages();
  const docs = listDocs();
  process.stdout.write("Atlas documentation\n\n");
  process.stdout.write("Packages (atlas docs <name>):\n");
  for (const p of packages) process.stdout.write(`  ${p}\n`);
  process.stdout.write("\nTop-level docs (atlas docs <name>):\n");
  for (const d of docs) process.stdout.write(`  ${d.replace(/\.md$/, "")}\n`);
};

const printPackage = (pkg: string): boolean => {
  const path = `${PACKAGES_DIR}/${pkg}/AGENTS.md`;
  if (!existsSync(path)) return false;
  process.stdout.write(readFileSync(path, "utf-8"));
  if (!process.stdout.write("\n")) return true;
  return true;
};

const printDoc = (name: string): boolean => {
  const fname = name.endsWith(".md") ? name : `${name}.md`;
  const path = `${DOCS_DIR}/${fname}`;
  if (!existsSync(path)) return false;
  process.stdout.write(readFileSync(path, "utf-8"));
  if (!process.stdout.write("\n")) return true;
  return true;
};

export const docsCommand = command("docs", {
  description: "Print Atlas documentation. `atlas docs <package>` for AGENTS.md, `atlas docs <doc>` for docs/*",
  run: async ({ args }) => {
    if (args.length === 0) {
      printIndex();
      return;
    }
    const target = args[0]!;
    if (printPackage(target)) return;
    if (printDoc(target)) return;
    process.stderr.write(`Unknown package or doc: "${target}"\n\n`);
    printIndex();
    process.exit(1);
  },
});
