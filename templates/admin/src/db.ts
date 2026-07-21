import { connect } from "@atlas/db"
import { config } from "./config.ts"

export const db = connect({
  driver: "postgres",
  url: config.databaseUrl,
  pool: config.dbPoolSize,
})
