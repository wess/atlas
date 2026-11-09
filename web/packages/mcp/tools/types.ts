import type { AtlasMcpContext } from "../context/index.ts";

export type ToolInput = {
  readonly type: "object";
  readonly properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  readonly required?: string[];
};

/** MCP tool annotations; clients use them to decide what needs confirmation. */
export type ToolAnnotations = {
  readonly readOnlyHint?: boolean;
  readonly destructiveHint?: boolean;
  readonly idempotentHint?: boolean;
};

export type Tool = {
  readonly name: string;
  readonly description: string;
  readonly annotations?: ToolAnnotations;
  readonly inputSchema: ToolInput;
  readonly handler: (params: Record<string, unknown>, ctx: AtlasMcpContext) => Promise<unknown>;
};

export const defineTool = (tool: Tool): Tool => tool;
