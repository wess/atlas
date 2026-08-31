import { connect } from "@atlas/db"
import { config } from "./config.ts"

const options = config.databaseUrl.startsWith("postgres")
  ? { driver: "postgres" as const, url: config.databaseUrl }
  : { driver: "sqlite" as const, path: config.databaseUrl.replace(/^sqlite:\/\//, "") }

export const db = connect(options)
