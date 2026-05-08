import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import type { Tool } from "./types.ts";
import { defineTool } from "./types.ts";

// Resolve the Atlas repo root from this file's location: packages/mcp/tools/docs.ts → ../../..
const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const PACKAGES_DIR = `${REPO_ROOT}packages`;
const DOCS_DIR = `${REPO_ROOT}docs`;

const listPackages = (): string[] => {
  if (!existsSync(PACKAGES_DIR)) return [];
  return readdirSync(PACKAGES_DIR)
    .filter((name) => {
      const stat = statSync(`${PACKAGES_DIR}/${name}`, { throwIfNoEntry: false });
      return stat?.isDirectory() && existsSync(`${PACKAGES_DIR}/${name}/AGENTS.md`);
    })
    .sort();
};

const readPackageAgents = (pkg: string): string => {
  const path = `${PACKAGES_DIR}/${pkg}/AGENTS.md`;
  if (!existsSync(path)) throw new Error(`No AGENTS.md found for package "${pkg}"`);
  return readFileSync(path, "utf-8");
};

const readDocFile = (name: string): string => {
  const path = `${DOCS_DIR}/${name}`;
  if (!existsSync(path)) throw new Error(`No doc file at docs/${name}`);
  return readFileSync(path, "utf-8");
};

export const docsTools: Tool[] = [
  defineTool({
    name: "docs.list",
    description:
      "List Atlas documentation sources: every package with an AGENTS.md, plus top-level docs/* files (api, cookbook, overview, quickstart). Returns identifiers usable with docs.read.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const packages = listPackages();
      const docs = existsSync(DOCS_DIR)
        ? readdirSync(DOCS_DIR)
            .filter((f) => f.endsWith(".md"))
            .sort()
        : [];
      return { packages, docs };
    },
  }),
  defineTool({
    name: "docs.read",
    description:
      "Read an Atlas documentation source. Pass `package` to load packages/<name>/AGENTS.md, or `doc` to load docs/<name>.md (e.g. 'api', 'cookbook', 'overview', 'quickstart'). Use docs.list to discover available identifiers.",
    inputSchema: {
      type: "object",
      properties: {
        package: { type: "string", description: "Package name under packages/, e.g. 'db' or 'server'" },
        doc: { type: "string", description: "Doc file under docs/, with or without .md (e.g. 'api')" },
      },
    },
    handler: async (params) => {
      const pkg = params.package as string | undefined;
      const doc = params.doc as string | undefined;
      if (pkg) return { source: `packages/${pkg}/AGENTS.md`, content: readPackageAgents(pkg) };
      if (doc) {
        const name = doc.endsWith(".md") ? doc : `${doc}.md`;
        return { source: `docs/${name}`, content: readDocFile(name) };
      }
      throw new Error("docs.read requires either `package` or `doc`");
    },
  }),
];
