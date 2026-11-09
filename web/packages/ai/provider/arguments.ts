// Tool arguments are model output: they can be truncated, invalid JSON, or not an object at all.
// Parse them without throwing so a bad call becomes an error the agent can report back to the model.
export const parseToolArguments = (raw: string | undefined): { arguments: Record<string, unknown>; error?: string } => {
  if (!raw?.trim()) return { arguments: {} };
  try {
    const value: unknown = JSON.parse(raw);
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return { arguments: value as Record<string, unknown> };
    }
    return { arguments: {}, error: "tool arguments must be a JSON object" };
  } catch {
    return { arguments: {}, error: "tool arguments were not valid JSON" };
  }
};
