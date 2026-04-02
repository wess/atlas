import { expect, test } from "bun:test";
import { command, flag, parseArgs } from "../command/index.ts";

test("flag creates a flag definition", () => {
  const f = flag("p", { type: "number", default: 3000, description: "Port" });
  expect(f.short).toBe("p");
  expect(f.type).toBe("number");
  expect(f.default).toBe(3000);
});

test("command creates a command definition", () => {
  const cmd = command("serve", {
    description: "Start server",
    flags: { port: flag("p", { type: "number", default: 3000 }) },
    run: () => {},
  });
  expect(cmd.name).toBe("serve");
  expect(cmd.description).toBe("Start server");
  expect(cmd.flags?.port.type).toBe("number");
});

test("parseArgs extracts flags and positional args", () => {
  const result = parseArgs(["--port", "8080", "file.ts"], {
    port: flag("p", { type: "number" }),
  });
  expect(result.args).toEqual(["file.ts"]);
  expect(result.flags.port).toBe(8080);
});

test("parseArgs handles boolean flags", () => {
  const result = parseArgs(["--verbose"], {
    verbose: flag("v", { type: "boolean" }),
  });
  expect(result.args).toEqual([]);
  expect(result.flags.verbose).toBe(true);
});

test("parseArgs uses short flags", () => {
  const result = parseArgs(["-p", "8080"], {
    port: flag("p", { type: "number" }),
  });
  expect(result.args).toEqual([]);
  expect(result.flags.port).toBe(8080);
});

test("parseArgs uses defaults", () => {
  const result = parseArgs([], {
    port: flag("p", { type: "number", default: 3000 }),
  });
  expect(result.args).toEqual([]);
  expect(result.flags.port).toBe(3000);
});

test("parseArgs handles string flags", () => {
  const result = parseArgs(["--host", "localhost"], {
    host: flag("h", { type: "string", default: "0.0.0.0" }),
  });
  expect(result.flags.host).toBe("localhost");
});

test("parseArgs mixes flags and positional args", () => {
  const result = parseArgs(["-v", "src/app.ts", "--port", "4000"], {
    verbose: flag("v", { type: "boolean" }),
    port: flag("p", { type: "number", default: 3000 }),
  });
  expect(result.args).toEqual(["src/app.ts"]);
  expect(result.flags.verbose).toBe(true);
  expect(result.flags.port).toBe(4000);
});
