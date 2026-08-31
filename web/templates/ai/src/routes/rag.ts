import { post, pipe, json } from "@atlas/server"
import { query as ragQuery } from "@atlas/ai"
import { ai } from "../ai.ts"
import { vectorStore } from "../vectors/index.ts"

export const ragRoutes = [
  post("/api/rag", pipe(async (c) => {
    const body = await c.request.json()
    const { question } = body as { question: string }

    if (!question) return json(c, 400, { error: "question is required" })

    const result = await ragQuery(
      { ai, store: vectorStore, topK: 5 },
      question,
    )

    return json(c, 200, {
      answer: result.answer,
      sources: result.sources,
    })
  })),
]
