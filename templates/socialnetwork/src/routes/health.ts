import { get, pipe, json } from "@atlas/server"

export const healthRoutes = [
  get("/health", pipe((c) => json(c, 200, { healthy: true }))),
]
