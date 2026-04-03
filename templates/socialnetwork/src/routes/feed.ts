import { get, json } from "@atlas/server"
import { db } from "../db.ts"
import { authed } from "../pipes/auth.ts"

export const feedRoutes = [
  get("/api/feed", authed(
    async (c) => {
      const limit = Number(c.query.limit) || 20
      const offset = Number(c.query.offset) || 0

      const rows = await db.query(
        `select p.id, p.user_id, p.content, p.image_url, p.created_at,
          u.username, u.name, u.avatar_url,
          (select count(*) from likes where post_id = p.id) as like_count,
          exists(select 1 from likes where post_id = p.id and user_id = $1) as liked_by_me
         from posts p
         join users u on u.id = p.user_id
         where p.user_id in (
           select following_id from follows where follower_id = $1
         )
         order by p.created_at desc
         limit $2 offset $3`,
        [c.auth.userId, limit, offset],
      )

      return json(c, 200, rows)
    },
  )),
]
