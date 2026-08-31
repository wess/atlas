import { from } from "@atlas/db"
import { del, get, internal, json, pipe, post } from "@atlas/server"
import { db } from "../db.ts"
import { documents } from "../schema.ts"
import { indexDocument } from "../vectors/index.ts"

export const documentRoutes = [
  post("/api/documents", pipe(async (c) => {
    const body = (await c.request.json()) as { title: string; content: string }
    const { title, content } = body

    if (!title || !content) {
      return json(c, 400, { error: "title and content are required" })
    }

    const rows = await db.execute(
      from(documents).insert({ title, content }).returning("id", "title", "created_at"),
    )
    const doc = rows[0]
    if (!doc) throw internal("Failed to create document")

    const embeddingId = `doc-${doc.id}`
    await indexDocument(content, { id: embeddingId, title, documentId: doc.id })
    await db.execute(
      from(documents).where(q => q("id").equals(doc.id)).update({ embedding_id: embeddingId }),
    )

    return json(c, 201, { ...doc, embeddingId })
  })),

  get("/api/documents", pipe(async (c) => {
    const rows = await db.all(
      from(documents).select("id", "title", "embedding_id", "created_at").orderBy("created_at", "DESC"),
    )
    return json(c, 200, rows)
  })),

  del("/api/documents/:id", pipe(async (c) => {
    await db.execute(from(documents).where(q => q("id").equals(Number(c.params.id))).del())
    return json(c, 204, null)
  })),
]
