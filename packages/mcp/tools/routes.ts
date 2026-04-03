import type { Tool } from "./types.ts";
import { defineTool } from "./types.ts";

export const routeTools: Tool[] = [
  defineTool({
    name: "routes.list",
    description: "List all registered HTTP routes with their methods and patterns",
    inputSchema: { type: "object", properties: {} },
    handler: async (_params, ctx) => {
      return ctx.routes!.map((r) => ({ method: r.method, pattern: r.pattern }));
    },
  }),
];
