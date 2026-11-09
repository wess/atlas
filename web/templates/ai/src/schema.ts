import { column, defineSchema } from "@wess/atlas/db/query";

export const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  password_hash: column.text(),
  created_at: column.timestamp(),
})

export const documents = defineSchema("documents", {
  id: column.serial().primaryKey(),
  title: column.text(),
  content: column.text(),
  embedding_id: column.text().nullable(),
  created_at: column.timestamp(),
})

export const conversations = defineSchema("conversations", {
  id: column.serial().primaryKey(),
  user_id: column.integer().nullable(),
  title: column.text().default("New conversation"),
  messages: column.text().default("[]"),
  created_at: column.timestamp(),
  updated_at: column.timestamp(),
})
