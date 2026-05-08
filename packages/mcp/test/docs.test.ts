import { expect, test } from "bun:test";
import { createContext } from "../context/index.ts";
import { collectTools } from "../tools/index.ts";
import { docsTools } from "../tools/docs.ts";

test("docs.* tools are always present, even with empty context", () => {
  const ctx = createContext();
  const tools = collectTools(ctx);
  expect(tools.some((t) => t.name === "docs.list")).toBe(true);
  expect(tools.some((t) => t.name === "docs.read")).toBe(true);
});

test("docs.list returns the package list and top-level docs", async () => {
  const ctx = createContext();
  const list = docsTools.find((t) => t.name === "docs.list")!;
  const result = (await list.handler({}, ctx)) as { packages: string[]; docs: string[] };
  expect(result.packages).toContain("db");
  expect(result.packages).toContain("server");
  expect(result.packages).toContain("mcp");
  expect(result.docs).toContain("api.md");
  expect(result.docs).toContain("cookbook.md");
});

test("docs.read returns the AGENTS.md for a package", async () => {
  const ctx = createContext();
  const read = docsTools.find((t) => t.name === "docs.read")!;
  const result = (await read.handler({ package: "db" }, ctx)) as { source: string; content: string };
  expect(result.source).toBe("packages/db/AGENTS.md");
  expect(result.content).toContain("@atlas/db");
  expect(result.content).toContain("defineSchema");
});

test("docs.read returns top-level doc files", async () => {
  const ctx = createContext();
  const read = docsTools.find((t) => t.name === "docs.read")!;
  const result = (await read.handler({ doc: "api" }, ctx)) as { source: string; content: string };
  expect(result.source).toBe("docs/api.md");
  expect(result.content).toContain("@atlas/db");
});

test("docs.read errors on missing package", async () => {
  const ctx = createContext();
  const read = docsTools.find((t) => t.name === "docs.read")!;
  await expect(read.handler({ package: "nonexistent" }, ctx)).rejects.toThrow("nonexistent");
});

test("docs.read errors when neither package nor doc is supplied", async () => {
  const ctx = createContext();
  const read = docsTools.find((t) => t.name === "docs.read")!;
  await expect(read.handler({}, ctx)).rejects.toThrow("requires either");
});
