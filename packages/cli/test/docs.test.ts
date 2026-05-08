import { afterEach, beforeEach, expect, test } from "bun:test";
import { docsCommand } from "../docs/index.ts";

type Captured = { stdout: string; stderr: string; exit: number | null };

let captured: Captured;
let originalStdout: typeof process.stdout.write;
let originalStderr: typeof process.stderr.write;
let originalExit: typeof process.exit;

beforeEach(() => {
  captured = { stdout: "", stderr: "", exit: null };
  originalStdout = process.stdout.write.bind(process.stdout);
  originalStderr = process.stderr.write.bind(process.stderr);
  originalExit = process.exit.bind(process);

  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured.stdout += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  }) as typeof process.stdout.write;

  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    captured.stderr += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  }) as typeof process.stderr.write;

  process.exit = ((code?: number) => {
    captured.exit = code ?? 0;
    throw new Error(`__exit_${captured.exit}`);
  }) as typeof process.exit;
});

afterEach(() => {
  process.stdout.write = originalStdout;
  process.stderr.write = originalStderr;
  process.exit = originalExit;
});

test("`atlas docs` with no args prints the package + doc index", async () => {
  await docsCommand.run({ args: [], flags: {} });
  expect(captured.stdout).toContain("Atlas documentation");
  expect(captured.stdout).toContain("Packages");
  expect(captured.stdout).toContain("  db");
  expect(captured.stdout).toContain("  server");
  expect(captured.stdout).toContain("Top-level docs");
  expect(captured.stdout).toContain("  api");
  expect(captured.stdout).toContain("  cookbook");
});

test("`atlas docs <package>` prints the package's AGENTS.md", async () => {
  await docsCommand.run({ args: ["db"], flags: {} });
  expect(captured.stdout).toContain("# @atlas/db");
  expect(captured.stdout).toContain("defineSchema");
  expect(captured.stdout).toContain("RowOf");
});

test("`atlas docs <doc>` prints docs/<name>.md", async () => {
  await docsCommand.run({ args: ["api"], flags: {} });
  expect(captured.stdout).toContain("Atlas API Reference");
  expect(captured.stdout).toContain("@atlas/server");
});

test("`atlas docs <unknown>` errors and prints the index", async () => {
  await expect(docsCommand.run({ args: ["nonexistent-pkg"], flags: {} })).rejects.toThrow(/__exit_1/);
  expect(captured.stderr).toContain('Unknown package or doc: "nonexistent-pkg"');
  expect(captured.stdout).toContain("Atlas documentation");
  expect(captured.exit).toBe(1);
});
