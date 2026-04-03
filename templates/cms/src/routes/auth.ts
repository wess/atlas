import { post, json } from "@atlas/server"
import { hashPassword, verifyPassword, signToken } from "@atlas/auth"
import { db } from "../db.ts"
import { config } from "../config.ts"
import { public_ } from "../pipes/auth.ts"

export const authRoutes = [
  post("/admin/api/auth/login", public_(
    async (c) => {
      const { email, password } = await c.req.json()

      if (!email || !password) {
        return json(c, 400, { error: "email and password are required" })
      }

      const rows = await db.query(
        "select id, email, name, role, password_hash from users where email = $1",
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

      const token = await signToken(
        { userId: user.id, role: user.role },
        config.auth.secret,
      )

      return json(c, 200, {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token,
      })
    },
  )),

  post("/admin/api/auth/register", public_(
    async (c) => {
      const { email, name, password } = await c.req.json()

      if (!email || !name || !password) {
        return json(c, 400, { error: "email, name, and password are required" })
      }

      const existing = await db.query(
        "select id from users where email = $1",
        [email],
      )

      if (existing.length > 0) {
        return json(c, 409, { error: "Email already taken" })
      }

      const passwordHash = await hashPassword(password)

      const rows = await db.query(
        `insert into users (email, name, role, password_hash)
         values ($1, $2, $3, $4)
         returning id, email, name, role, created_at`,
        [email, name, "admin", passwordHash],
      )

      const user = rows[0]
      const token = await signToken(
        { userId: user.id, role: user.role },
        config.auth.secret,
      )

      return json(c, 201, { user, token })
    },
  )),
]
