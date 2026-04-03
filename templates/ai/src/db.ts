import { createPool } from "@atlas/db"
import { config } from "./config.ts"

export const db = createPool({
  url: config.databaseUrl,
})
