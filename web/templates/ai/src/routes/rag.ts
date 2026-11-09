import { post, json } from "@wess/atlas/server"
import { query as ragQuery } from "@wess/atlas/ai"
import { ai } from "../ai.ts"
import { authed } from "../pipes/auth.ts"
import { vectorStore } from "../vectors/index.ts"

export const ragRoutes = [
  post("/api/rag", authed(async (c) => {
    const { question } = (c.body ?? {}) as { question?: string }

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
