import { post, json } from "@wess/atlas/server"
import { authed } from "../pipes/auth.ts"
import { searchDocuments } from "../vectors/index.ts"

export const searchRoutes = [
  post("/api/search", authed(async (c) => {
    const { query: q, topK } = (c.body ?? {}) as { query?: string; topK?: number }

    if (!q) return json(c, 400, { error: "query is required" })

    const results = await searchDocuments(q, Math.min(Number(topK) || 5, 20))
    return json(c, 200, { results })
  })),
]
