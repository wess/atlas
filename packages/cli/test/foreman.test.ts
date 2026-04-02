import { expect, test } from "bun:test";
import { parseProcfile } from "../foreman/index.ts";

test("parseProcfile parses entries", () => {
  const content = `
web: bun run server.ts
worker: bun run worker.ts
  `;
  const procs = parseProcfile(content);
  expect(procs.web).toBe("bun run server.ts");
  expect(procs.worker).toBe("bun run worker.ts");
});

test("parseProcfile ignores comments and blank lines", () => {
  const content = `
# This is a comment

web: bun run server.ts
# Another comment
  `;
  const procs = parseProcfile(content);
  expect(Object.keys(procs)).toEqual(["web"]);
});

test("parseProcfile handles colons in commands", () => {
  const content = `web: bun run --port:3000 server.ts`;
  const procs = parseProcfile(content);
  expect(procs.web).toBe("bun run --port:3000 server.ts");
});

test("parseProcfile returns empty for empty input", () => {
  const procs = parseProcfile("");
  expect(Object.keys(procs)).toEqual([]);
});

test("parseProcfile handles multiple processes", () => {
  const content = `
web: bun run server.ts
worker: bun run worker.ts
cron: bun run cron.ts
  `;
  const procs = parseProcfile(content);
  expect(Object.keys(procs).length).toBe(3);
  expect(procs.cron).toBe("bun run cron.ts");
});
