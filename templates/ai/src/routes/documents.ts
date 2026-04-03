import { get, post, del, pipe, json } from "@atlas/server"
import { db } from "../db.ts"
import { indexDocument } from "../vectors/index.ts"

export const documentRoutes = [
  post("/api/documents", pipe(async (c) => {
    const body = await c.request.json()
    const { title, content } = body as { title: string; content: string }

    if (!title || !content) {
      return json(c, 400, { error: "title and content are required" })
    }

    const rows = await db.query(
      "insert into documents (title, content) values ($1, $2) returning id, title, created_at",
      [title, content],
    )

    const doc = rows[0]
    const embeddingId = `doc-${doc.id}`

    await indexDocument(content, { id: embeddingId, title, documentId: doc.id })
    await db.query(
      "update documents set embedding_id = $1 where id = $2",
      [embeddingId, doc.id],
    )

    return json(c, 201, { ...doc, embeddingId })
  })),

  get("/api/documents", pipe(async (c) => {
    const rows = await db.query(
      "select id, title, embedding_id, created_at from documents order by created_at desc",
    )
    return json(c, 200, rows)
  })),

  del("/api/documents/:id", pipe(async (c) => {
    await db.query("delete from documents where id = $1", [c.params.id])
    return json(c, 204, null)
  })),
]
