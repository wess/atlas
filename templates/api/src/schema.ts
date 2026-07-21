import { column, defineSchema } from "@atlas/db"

export const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  name: column.text(),
  password_hash: column.text(),
  created: column.timestamp(),
  updated: column.timestamp(),
})
