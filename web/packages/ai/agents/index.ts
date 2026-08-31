import { assistantMessage, toolMessage, userMessage } from "../chat/index.ts";
import type { AiProvider, Message, ToolDef } from "../provider/index.ts";

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
      const agentTool = agent.tools.find((t) => t.definition.name === call.name);
      if (!agentTool) {
        messages.push(toolMessage(call.id, `Error: unknown tool ${call.name}`));
        continue;
      }
      const result = await agentTool.handler(call.arguments);
      messages.push(toolMessage(call.id, result));
    }
  }

  return { response: "Max iterations reached", messages, iterations: maxIter };
};
