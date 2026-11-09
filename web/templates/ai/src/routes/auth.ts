import { timingSafeEqual } from "node:crypto"
import { hash, verify } from "@wess/atlas/auth/password";
import * as token from "@wess/atlas/auth/token";
import { from } from "@wess/atlas/db/query";
import { json, post } from "@wess/atlas/server"
import { config } from "../config.ts"
import { db } from "../db.ts"
import { api } from "../pipes/auth.ts"
import { users } from "../schema.ts"

const dayInSeconds = 60 * 60 * 24

const issueToken = (userId: number) => token.sign({ userId }, config.auth.secret, { expiresIn: dayInSeconds })

const setupTokenMatches = (provided: string) => {
  const expected = config.setupSecret
  return Buffer.byteLength(provided) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

type Credentials = { email?: string; password?: string }

export const authRoutes = [
  // Accounts are invite-only: whoever holds ADMIN_SETUP_SECRET can create them.
  post(
    "/api/auth/register",
    api(async (c) => {
      if (!setupTokenMatches(c.headers.get("x-setup-token") ?? "")) {
        return json(c, 403, { error: "Setup token required to create an account" })
      }

      const { email, password } = (c.body ?? {}) as Credentials
      if (!email || !password) return json(c, 400, { error: "email and password are required" })

      const existing = await db.one(from(users).select("id").where((q) => q("email").equals(email)))
      if (existing) return json(c, 409, { error: "Email already taken" })

      const rows = await db.execute(
        from(users).insert({ email, password_hash: await hash(password) }).returning("id", "email"),
      )
      const user = rows[0]
      if (!user) return json(c, 500, { error: "Registration failed" })

      return json(c, 201, { user, token: await issueToken(user.id) })
    }),
  ),

  post(
    "/api/auth/login",
    api(async (c) => {
      const { email, password } = (c.body ?? {}) as Credentials
      if (!email || !password) return json(c, 400, { error: "email and password are required" })

      const user = await db.one(from(users).where((q) => q("email").equals(email)))
      if (!user || !(await verify(password, user.password_hash))) {
        return json(c, 401, { error: "Invalid credentials" })
      }

      return json(c, 200, { user: { id: user.id, email: user.email }, token: await issueToken(user.id) })
    }),
  ),
]
