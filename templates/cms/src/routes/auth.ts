import { hash, token, verify } from "@atlas/auth"
import { from } from "@atlas/db"
import { json, parseJson, pipeline, post } from "@atlas/server"
import { config } from "../config.ts"
import { db } from "../db.ts"
import { users } from "../schema.ts"

const api = pipeline(parseJson)

const dayInSeconds = 60 * 60 * 24

const issueToken = (userId: number, role: string) =>
  token.sign({ userId, role }, config.auth.secret, { expiresIn: dayInSeconds })

export const authRoutes = [
  post(
    "/admin/api/auth/login",
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
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token: await issueToken(user.id, user.role),
      })
    }),
  ),

  post(
    "/admin/api/auth/register",
    api(async (c) => {
      const { email, name, password } = (c.body ?? {}) as { email?: string; name?: string; password?: string }

      if (!email || !name || !password) {
        return json(c, 400, { error: "email, name, and password are required" })
      }

      const existing = await db.one(
        from(users)
          .select("id")
          .where((q) => q("email").equals(email)),
      )
      if (existing) return json(c, 409, { error: "Email already taken" })

      const rows = await db.execute(
        from(users)
          .insert({ email, name, role: "admin", passwordHash: await hash(password) })
          .returning("id", "email", "name", "role", "createdAt"),
      )
      const user = rows[0]
      if (!user) return json(c, 500, { error: "Registration failed" })

      return json(c, 201, { user, token: await issueToken(user.id, user.role) })
    }),
  ),
]
