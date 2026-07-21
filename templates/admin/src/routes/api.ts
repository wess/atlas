import { requireAuth } from "@atlas/auth"
import { from, raw } from "@atlas/db"
import { get, json, parseJson, pipe, pipeline, post } from "@atlas/server"
import { config } from "../config.ts"
import { db } from "../db.ts"
import { posts, users } from "../schema.ts"

const guard = pipeline(requireAuth({ secret: config.authSecret }))
const authed = pipeline(requireAuth({ secret: config.authSecret }), parseJson)

export const apiRoutes = [
  get("/api/health", pipe((c) => json(c, 200, { healthy: true }))),

  get("/api/users", guard(async (c) => {
    const rows = await db.all(from(users).select("id", "email", "name", "role", "created"))
    return json(c, 200, rows)
  })),

  get("/api/posts", pipe(async (c) => {
    const rows = await db.all(
      from("posts")
        .join("users", raw("users.id = posts.author_id"))
        .where(q => q("posts.published").equals(true))
        .select("posts.id", "posts.title", "posts.body", "posts.created", raw("users.name as author"))
        .orderBy("posts.created", "DESC"),
    )
    return json(c, 200, rows)
  })),

  post("/api/posts", authed(async (c) => {
    const { title, body, authorId } = c.body as { title: string; body: string; authorId: number }
    const rows = await db.execute(
      from(posts).insert({ title, body, author_id: authorId }).returning("id", "title", "created"),
    )
    return json(c, 201, rows[0] ?? null)
  })),
]
