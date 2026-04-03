import { post, json } from "@atlas/server"
import { hashPassword, verifyPassword, signToken } from "@atlas/auth"
import { db } from "../db.ts"
import { config } from "../config.ts"
import { public_ } from "../pipes/auth.ts"

export const authRoutes = [
  post("/api/auth/signup", public_(
    async (c) => {
      const { email, username, name, password } = await c.req.json()

      if (!email || !username || !name || !password) {
        return json(c, 400, { error: "email, username, name, and password are required" })
      }

      const existing = await db.query(
        "select id from users where email = $1 or username = $2",
        [email, username],
      )

      if (existing.length > 0) {
        return json(c, 409, { error: "Email or username already taken" })
      }

      const passwordHash = await hashPassword(password)

      const rows = await db.query(
        `insert into users (email, username, name, password_hash)
         values ($1, $2, $3, $4)
         returning id, email, username, name, created_at`,
        [email, username, name, passwordHash],
      )

      const user = rows[0]
      const token = await signToken({ userId: user.id }, config.auth.secret)

      return json(c, 201, { user, token })
    },
  )),

  post("/api/auth/login", public_(
    async (c) => {
      const { email, password } = await c.req.json()

      if (!email || !password) {
        return json(c, 400, { error: "email and password are required" })
      }

      const rows = await db.query(
        "select id, email, username, name, password_hash from users where email = $1",
        [email],
      )

      if (rows.length === 0) {
        return json(c, 401, { error: "Invalid credentials" })
      }

      const user = rows[0]
      const valid = await verifyPassword(password, user.password_hash)

      if (!valid) {
        return json(c, 401, { error: "Invalid credentials" })
      }

      const token = await signToken({ userId: user.id }, config.auth.secret)

      return json(c, 200, {
        user: { id: user.id, email: user.email, username: user.username, name: user.name },
        token,
      })
    },
  )),
]
