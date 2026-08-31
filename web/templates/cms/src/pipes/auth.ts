import { requireAuth } from "@atlas/auth"
import type { Conn } from "@atlas/server"
import { parseJson, parseMultipart, pipeline } from "@atlas/server"
import { config } from "../config.ts"

export const authed = pipeline(requireAuth({ secret: config.auth.secret }), parseJson)
export const guard = pipeline(requireAuth({ secret: config.auth.secret }))
export const uploads = pipeline(requireAuth({ secret: config.auth.secret }), parseMultipart)

export type AuthClaims = { readonly userId: number; readonly role: string }

export const claims = (c: Conn): AuthClaims => c.assigns.auth as AuthClaims
