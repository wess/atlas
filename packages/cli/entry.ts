#!/usr/bin/env bun
import { cli, command } from "./command/index.ts";
import { initCommand } from "./init/index.ts";
import { addCommand } from "./add/index.ts";
import { foreman } from "./foreman/index.ts";

const devCommand = command("dev", {
  description: "Start development servers from Procfile",
  run: async () => {
    await foreman("Procfile");
  },
});

const mcpCommand = command("mcp", {
  description: "Start MCP server for AI/LLM debugging",
  run: async () => {
    const proc = Bun.spawn(["bun", "run", new URL("../mcp/entry.ts", import.meta.url).pathname], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env },
    });
    await proc.exited;
  },
});

cli("atlas", [initCommand, addCommand, devCommand, mcpCommand]);
