import { column, defineSchema } from "@atlas/db"

export const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  name: column.text(),
  role: column.text().default("user"),
  created: column.timestamp(),
})

export const posts = defineSchema("posts", {
  id: column.serial().primaryKey(),
  title: column.text(),
  body: column.text(),
  author_id: column.integer().ref("users", "id"),
  published: column.boolean().default(false),
  created: column.timestamp(),
  updated: column.timestamp(),
})
