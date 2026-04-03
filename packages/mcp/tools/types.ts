import type { AtlasMcpContext } from "../context/index.ts";

export type ToolInput = {
  readonly type: "object";
  readonly properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  readonly required?: string[];
};

export type Tool = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolInput;
  readonly handler: (params: Record<string, unknown>, ctx: AtlasMcpContext) => Promise<unknown>;
};

export const defineTool = (tool: Tool): Tool => tool;
