import { defineSchema, column } from "@atlas/db"

export const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  name: column.text(),
  role: column.text().default("editor"),
  passwordHash: column.text(),
  createdAt: column.timestamp().default("CURRENT_TIMESTAMP"),
})

export const contentTypes = defineSchema("content_types", {
  id: column.serial().primaryKey(),
  name: column.text().unique(),
  displayName: column.text(),
  fields: column.json(),
  createdAt: column.timestamp().default("CURRENT_TIMESTAMP"),
  updatedAt: column.timestamp().default("CURRENT_TIMESTAMP"),
})

export const entries = defineSchema("entries", {
  id: column.serial().primaryKey(),
  contentTypeId: column.integer().ref("content_types", "id"),
  slug: column.text(),
  data: column.json(),
  status: column.text().default("draft"),
  authorId: column.integer().ref("users", "id"),
  publishedAt: column.timestamp().nullable(),
  createdAt: column.timestamp().default("CURRENT_TIMESTAMP"),
  updatedAt: column.timestamp().default("CURRENT_TIMESTAMP"),
})

export const media = defineSchema("media", {
  id: column.serial().primaryKey(),
  filename: column.text(),
  key: column.text(),
  url: column.text(),
  contentType: column.text(),
  size: column.integer(),
  alt: column.text().nullable(),
  uploadedBy: column.integer().ref("users", "id"),
  createdAt: column.timestamp().default("CURRENT_TIMESTAMP"),
})

export const apiKeys = defineSchema("api_keys", {
  id: column.serial().primaryKey(),
  name: column.text(),
  key: column.text().unique(),
  permissions: column.json(),
  createdAt: column.timestamp().default("CURRENT_TIMESTAMP"),
  lastUsedAt: column.timestamp().nullable(),
})

export const revisions = defineSchema("revisions", {
  id: column.serial().primaryKey(),
  entryId: column.integer().ref("entries", "id"),
  data: column.json(),
  authorId: column.integer().ref("users", "id"),
  createdAt: column.timestamp().default("CURRENT_TIMESTAMP"),
})

export const webhooks = defineSchema("webhooks", {
  id: column.serial().primaryKey(),
  url: column.text(),
  events: column.json(),
  secret: column.text(),
  active: column.integer().default(1),
  createdAt: column.timestamp().default("CURRENT_TIMESTAMP"),
})
