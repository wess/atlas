import type { AtlasMcpContext } from "../context/index.ts";
import type { Tool } from "./types.ts";
import { dbTools } from "./db.ts";
import { migrateTools } from "./migrate.ts";
import { cacheTools } from "./cache.ts";
import { routeTools } from "./routes.ts";
import { configTools } from "./config.ts";
import { storageTools } from "./storage.ts";
import { healthTools } from "./health.ts";
import { logTools } from "./logs.ts";

export type { ToolInput, Tool } from "./types.ts";
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
  if (ctx.logBuffer) tools.push(...logTools);

  return tools;
};
