import type { Connection } from "@atlas/db"
import { from } from "@atlas/db"
import { pipeline, parseJson, json, post } from "@atlas/server"
import { signup, login, token } from "@atlas/auth"
import { users } from "../schema/index.ts"

export const authRoutes = (db: Connection, secret: string) => {
  const api = pipeline(parseJson)

  return [
    post("/signup", api(
      signup({
        db,
        table: "users",
        fields: ["handle", "email", "password"],
        onSuccess: (c, user) => json(c, 201, {
          id: user.id,
          handle: user.handle,
          email: user.email,
        }),
      })
    )),

    post("/login", api(
      login({
        db,
        table: "users",
        identity: "email",
        password: "password",
        onSuccess: async (c, user) => json(c, 200, {
          token: await token.sign({ id: user.id, handle: user.handle }, secret, { expiresIn: 86400 }),
        }),
      })
    )),
  ]
}
