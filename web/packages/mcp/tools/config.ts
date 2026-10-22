import type { Tool } from "./types.ts";
import { defineTool } from "./types.ts";

const REDACT_PATTERNS =
  /secret|password|passwd|key|token|credential|authorization|cookie|dsn|database.?url|redis.?url/i;

const redact = (value: unknown, key = "", seen = new WeakSet<object>()): unknown => {
  if (REDACT_PATTERNS.test(key)) return "***REDACTED***";
  if (typeof value === "string" && /[a-z][a-z0-9+.-]*:\/\/[^/\s]*@/i.test(value)) return "***REDACTED***";
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  const result = Array.isArray(value)
    ? value.map((item) => redact(item, key, seen))
    : Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name, seen)]));
  seen.delete(value);
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
