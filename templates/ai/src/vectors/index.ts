import { createVectorStore, embed } from "@atlas/ai"
import type { VectorStore } from "@atlas/ai"
import { ai } from "../ai.ts"

export const vectorStore: VectorStore = createVectorStore()

export const indexDocument = async (
  text: string,
  metadata: Record<string, unknown>,
): Promise<void> => {
  const chunks = chunkText(text, 500)
  const id = metadata.id as string

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const [embedding] = await embed(ai, chunk)
    if (embedding) {
      vectorStore.add(`${id}-${i}`, embedding, { ...metadata, text: chunk, chunkIndex: i })
    }
  }
}

export const searchDocuments = async (
  query: string,
  topK: number = 5,
): Promise<{ id: string; score: number; text: string; metadata: Record<string, unknown> }[]> => {
  const [queryEmbedding] = await embed(ai, query)
  if (!queryEmbedding) return []

  const results = vectorStore.search(queryEmbedding, topK)
  return results.map(r => ({
    id: r.id,
    score: r.score,
    text: (r.metadata.text as string) ?? "",
    metadata: r.metadata,
  }))
}

const chunkText = (text: string, maxLen: number): string[] => {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let current = ""

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLen && current.length > 0) {
      chunks.push(current.trim())
      current = ""
    }
    current += sentence + " "
  }

  if (current.trim().length > 0) chunks.push(current.trim())
  return chunks.length > 0 ? chunks : [text]
}
