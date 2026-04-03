import type { AiProvider, ToolDef } from "../provider/index.ts";

export const generateJson = async <T>(
  ai: AiProvider,
  prompt: string,
  opts?: { schema?: string; model?: string },
): Promise<T> => {
  const response = await ai.chat({
    messages: [
      {
        role: "system",
        content: opts?.schema
          ? `Respond with valid JSON matching this schema: ${opts.schema}`
          : "Respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    model: opts?.model,
    jsonMode: true,
  });
  return JSON.parse(response.content) as T;
};

export const tool = (name: string, description: string, parameters: Record<string, unknown>): ToolDef => ({
  name,
  description,
  parameters,
});
