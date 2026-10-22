#!/usr/bin/env bun
import { addCommand } from "./add/index.ts";
import { cli, command } from "./command/index.ts";
import { docsCommand } from "./docs/index.ts";
import { foreman } from "./foreman/index.ts";
import { initCommand } from "./init/index.ts";
import { checkCommand } from "./libraries/index.ts";

const devCommand = command("dev", {
  description: "Start development servers from Procfile",
  run: async () => {
    await foreman("Procfile");
  },
});

const mcpCommand = command("mcp", {
  description: "Start MCP server for AI/LLM debugging",
  run: async () => {
    const entry = Bun.resolveSync("@wess/atlas/mcp/entry", process.cwd());
    const proc = Bun.spawn(["bun", "run", entry], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env },
    });
    await proc.exited;
  },
});

cli("atlas", [initCommand, addCommand, checkCommand, devCommand, mcpCommand, docsCommand]);
