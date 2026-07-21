import { connect } from "@atlas/db"
import { config } from "./config.ts"

const path = config.databaseUrl.replace(/^sqlite:\/\//, "")

export const db = connect({ driver: "sqlite", path })
