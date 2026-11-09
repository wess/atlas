import { assistantMessage, toolMessage, userMessage } from "../chat/index.ts";
import type { AiProvider, Message, ToolCall, ToolDef } from "../provider/index.ts";

export type AgentTool = {
  readonly definition: ToolDef;
  readonly handler: (args: Record<string, unknown>) => Promise<string>;
};

export type AgentOptions = {
  readonly ai: AiProvider;
  readonly tools: AgentTool[];
  readonly system?: string;
  readonly maxIterations?: number;
  readonly model?: string;
  // Called before every tool call; return false to refuse it. The model sees the refusal as the tool result.
  readonly approve?: (call: ToolCall) => boolean | Promise<boolean>;
};

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// Everything that goes wrong in a tool call becomes the tool's result, so the model can recover
// and the loop keeps going. Only the message is returned, never the stack.
const runTool = async (agent: AgentOptions, call: ToolCall): Promise<string> => {
  if (call.error) return `Error: ${call.error}`;
  const agentTool = agent.tools.find((t) => t.definition.name === call.name);
  if (!agentTool) return `Error: unknown tool ${call.name}`;
  if (agent.approve && !(await agent.approve(call))) return `Error: tool call ${call.name} was not approved`;
  try {
    return await agentTool.handler(call.arguments);
  } catch (error) {
    return `Error: ${errorText(error)}`;
  }
};

export const runAgent = async (
  agent: AgentOptions,
  input: string,
): Promise<{ response: string; messages: Message[]; iterations: number }> => {
  const maxIter = agent.maxIterations ?? 10;
  const messages: Message[] = [];

  if (agent.system) messages.push({ role: "system", content: agent.system });
  messages.push(userMessage(input));

  for (let i = 0; i < maxIter; i++) {
    const response = await agent.ai.chat({
      messages,
      tools: agent.tools.map((t) => t.definition),
      model: agent.model,
    });

    if (!response.toolCalls?.length) {
      messages.push(assistantMessage(response.content));
      return { response: response.content, messages, iterations: i + 1 };
    }

    messages.push({ role: "assistant", content: response.content, toolCalls: response.toolCalls });

    for (const call of response.toolCalls) {
      messages.push(toolMessage(call.id, await runTool(agent, call)));
    }
  }

  return { response: "Max iterations reached", messages, iterations: maxIter };
};
