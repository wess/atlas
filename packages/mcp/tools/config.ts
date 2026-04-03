import type { Tool } from "./types.ts";
import { defineTool } from "./types.ts";

const REDACT_PATTERNS = /secret|password|key|token/i;

const redact = (obj: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = redact(value as Record<string, unknown>);
    } else if (typeof value === "string" && REDACT_PATTERNS.test(key)) {
      result[key] = "***REDACTED***";
    } else {
      result[key] = value;
    }
  }
  return result;
};

export const configTools: Tool[] = [
  defineTool({
    name: "config.show",
    description: "Show current application config with secrets redacted",
    inputSchema: { type: "object", properties: {} },
    handler: async (_params, ctx) => redact(ctx.config!),
  }),
];
