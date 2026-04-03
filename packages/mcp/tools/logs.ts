import type { Tool } from "./types.ts";
import { defineTool } from "./types.ts";

export const logTools: Tool[] = [
  defineTool({
    name: "logs.tail",
    description: "Get recent log lines from the application",
    inputSchema: {
      type: "object",
      properties: { lines: { type: "number", description: "Number of lines (default 50)" } },
    },
    handler: async (params, ctx) => {
      const n = (params.lines as number) ?? 50;
      const logs = ctx.logBuffer!.slice(-n);
      return { lines: logs, count: logs.length };
    },
  }),
];
