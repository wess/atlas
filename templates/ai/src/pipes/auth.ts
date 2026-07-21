import { requireAuth } from "@atlas/auth"
import { parseJson, pipeline } from "@atlas/server"
import { config } from "../config.ts"

// Wrap a route handler to require a Bearer JWT signed with AUTH_SECRET.
// The routes ship open by default; swap `pipe(...)` for `authed(...)` to lock one down.
export const authed = pipeline(requireAuth({ secret: config.auth.secret }), parseJson)
