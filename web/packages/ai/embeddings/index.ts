import type { AiProvider } from "../provider/index.ts";

export type VectorEntry = {
  readonly id: string;
  readonly embedding: number[];
  readonly metadata: Record<string, unknown>;
};

export type VectorStore = {
  readonly add: (id: string, embedding: number[], metadata?: Record<string, unknown>) => void;
  readonly search: (
    query: number[],
    topK?: number,
  ) => { id: string; score: number; metadata: Record<string, unknown> }[];
  readonly size: () => number;
};

export const embed = async (ai: AiProvider, input: string | string[]): Promise<number[][]> => {
  const result = await ai.embed({ input });
  return result.embeddings;
};

export const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const createVectorStore = (): VectorStore => {
  const entries: VectorEntry[] = [];
  return {
    add: (id, embedding, metadata = {}) => {
      entries.push({ id, embedding, metadata });
    },
    search: (query, topK = 5) => {
      return entries
        .map((e) => ({ id: e.id, score: cosineSimilarity(query, e.embedding), metadata: e.metadata }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    },
    size: () => entries.length,
  };
};
