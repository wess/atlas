import { requireAuth } from "@atlas/auth"
import type { Conn } from "@atlas/server"
import { parseJson, parseMultipart, pipeline } from "@atlas/server"
import { config } from "../config.ts"

export const api = pipeline(parseJson)
export const authed = pipeline(requireAuth({ secret: config.auth.secret }), parseJson)
export const guard = pipeline(requireAuth({ secret: config.auth.secret }))
export const uploads = pipeline(requireAuth({ secret: config.auth.secret }), parseMultipart)

export const currentUserId = (c: Conn): number => (c.assigns.auth as { userId: number }).userId
