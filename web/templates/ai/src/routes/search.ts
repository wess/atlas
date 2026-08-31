import { post, pipe, json } from "@atlas/server"
import { searchDocuments } from "../vectors/index.ts"

export const searchRoutes = [
  post("/api/search", pipe(async (c) => {
    const body = await c.request.json()
    const { query: q, topK } = body as { query: string; topK?: number }

    if (!q) return json(c, 400, { error: "query is required" })

    const results = await searchDocuments(q, topK ?? 5)
    return json(c, 200, { results })
  })),
]
