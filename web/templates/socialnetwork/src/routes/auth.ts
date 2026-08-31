import { hash, token, verify } from "@atlas/auth"
import { from } from "@atlas/db"
import { json, post } from "@atlas/server"
import { config } from "../config.ts"
import { db } from "../db.ts"
import { api } from "../pipes/auth.ts"
import { users } from "../schema.ts"

const weekInSeconds = 60 * 60 * 24 * 7

const issueToken = (userId: number) => token.sign({ userId }, config.auth.secret, { expiresIn: weekInSeconds })

export const authRoutes = [
  post(
    "/api/auth/signup",
    api(async (c) => {
      const { email, username, name, password } = (c.body ?? {}) as {
        email?: string
        username?: string
        name?: string
        password?: string
      }

      if (!email || !username || !name || !password) {
        return json(c, 400, { error: "email, username, name, and password are required" })
      }

      const existing = await db.one(
        from(users)
          .select("id")
          .where((q) => q.or(q("email").equals(email), q("username").equals(username))),
      )
      if (existing) return json(c, 409, { error: "Email or username already taken" })

      const rows = await db.execute(
        from(users)
          .insert({ email, username, name, passwordHash: await hash(password) })
          .returning("id", "email", "username", "name", "createdAt"),
      )
      const user = rows[0]
      if (!user) return json(c, 500, { error: "Signup failed" })

      return json(c, 201, { user, token: await issueToken(user.id) })
    }),
  ),

  post(
    "/api/auth/login",
    api(async (c) => {
      const { email, password } = (c.body ?? {}) as { email?: string; password?: string }

      if (!email || !password) {
        return json(c, 400, { error: "email and password are required" })
      }

      const user = await db.one(from(users).where((q) => q("email").equals(email)))
      if (!user || !(await verify(password, user.passwordHash))) {
        return json(c, 401, { error: "Invalid credentials" })
      }

      return json(c, 200, {
        user: { id: user.id, email: user.email, username: user.username, name: user.name },
        token: await issueToken(user.id),
      })
    }),
  ),
]
