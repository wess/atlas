import type { AiProvider, ChatOptions, ChatResponse, Message } from "../provider/index.ts";

export type Conversation = {
  readonly messages: Message[];
  readonly system?: string;
};

export const createConversation = (system?: string): Conversation => ({
  messages: [],
  system,
});

export const addMessage = (conv: Conversation, message: Message): Conversation => ({
  ...conv,
  messages: [...conv.messages, message],
});

export const userMessage = (content: string): Message => ({ role: "user", content });
export const assistantMessage = (content: string): Message => ({ role: "assistant", content });
export const systemMessage = (content: string): Message => ({ role: "system", content });
export const toolMessage = (toolCallId: string, content: string): Message => ({ role: "tool", content, toolCallId });

export const send = async (
  ai: AiProvider,
  conv: Conversation,
  content: string,
  opts?: Partial<ChatOptions>,
): Promise<{ conversation: Conversation; response: ChatResponse }> => {
  const updated = addMessage(conv, userMessage(content));
  const messages = conv.system ? [systemMessage(conv.system), ...updated.messages] : updated.messages;
  const response = await ai.chat({ messages, ...opts });
  const final = addMessage(updated, assistantMessage(response.content));
  return { conversation: final, response };
};
