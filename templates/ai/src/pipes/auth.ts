import { pipe, withAuth, withCors, withJson } from "@atlas/server"
import { config } from "../config.ts"

export const authed = pipe(
  withCors(),
  withJson(),
  withAuth({ secret: config.auth.secret }),
)

export const public_ = pipe(
  withCors(),
  withJson(),
)
