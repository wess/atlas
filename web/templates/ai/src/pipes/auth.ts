import { requireAuth } from "@wess/atlas/auth/flows";
import type { Conn } from "@wess/atlas/server"
import { parseJson, pipeline } from "@wess/atlas/server"
import { config } from "../config.ts"

// Every /api route except health and sign-in runs behind one of these: each call to the
// model costs money, and conversations belong to the account that started them.
export const api = pipeline(parseJson)
export const authed = pipeline(requireAuth({ secret: config.auth.secret }), parseJson)
export const guard = pipeline(requireAuth({ secret: config.auth.secret }))

export const currentUserId = (c: Conn): number => (c.assigns.auth as { userId: number }).userId
