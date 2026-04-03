import type { AiProvider } from "../provider/index.ts";
import { embed } from "../embeddings/index.ts";
import type { VectorStore } from "../embeddings/index.ts";

export type RagOptions = {
  readonly ai: AiProvider;
  readonly store: VectorStore;
  readonly topK?: number;
  readonly systemPrompt?: string;
};

export const index = async (
  rag: RagOptions,
  id: string,
  text: string,
  metadata?: Record<string, unknown>,
): Promise<void> => {
  const [embedding] = await embed(rag.ai, text);
  if (embedding) rag.store.add(id, embedding, { ...metadata, text });
};

export const query = async (
  rag: RagOptions,
  question: string,
  opts?: { model?: string },
): Promise<{ answer: string; sources: { id: string; score: number; text: string }[] }> => {
  const [queryEmbedding] = await embed(rag.ai, question);
  if (!queryEmbedding) throw new Error("Failed to generate query embedding");

  const results = rag.store.search(queryEmbedding, rag.topK ?? 5);
  const context = results
    .map((r) => (r.metadata.text as string) ?? "")
    .filter(Boolean)
    .join("\n\n---\n\n");

  const systemPrompt =
    rag.systemPrompt ??
    "Answer the question using the provided context. If the context doesn't contain the answer, say so.";

  const response = await rag.ai.chat({
    messages: [
      { role: "system", content: `${systemPrompt}\n\nContext:\n${context}` },
      { role: "user", content: question },
    ],
    model: opts?.model,
  });

  return {
    answer: response.content,
    sources: results.map((r) => ({ id: r.id, score: r.score, text: (r.metadata.text as string) ?? "" })),
  };
};
