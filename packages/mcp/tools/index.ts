import type { AtlasMcpContext } from "../context/index.ts";
import type { Tool } from "./types.ts";
import { cacheTools } from "./cache.ts";
import { configTools } from "./config.ts";
import { dbTools } from "./db.ts";
import { docsTools } from "./docs.ts";
import { healthTools } from "./health.ts";
import { logTools } from "./logs.ts";
import { migrateTools } from "./migrate.ts";
import { routeTools } from "./routes.ts";
import { storageTools } from "./storage.ts";

export type { Tool, ToolInput } from "./types.ts";
export { defineTool } from "./types.ts";

export const collectTools = (ctx: AtlasMcpContext): Tool[] => {
  const tools: Tool[] = [];

  if (ctx.db) {
    tools.push(...dbTools);
    if (ctx.migrationsDir) tools.push(...migrateTools);
  }
  if (ctx.cache) tools.push(...cacheTools);
  if (ctx.routes) tools.push(...routeTools);
  if (ctx.config) tools.push(...configTools);
  if (ctx.storage) tools.push(...storageTools);
  tools.push(...healthTools);
  // docs.* tools are always available — they describe Atlas itself, not user services.
  tools.push(...docsTools);
  if (ctx.logBuffer) tools.push(...logTools);

  return tools;
};
