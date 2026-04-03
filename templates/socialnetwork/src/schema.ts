import { defineSchema, column } from "@atlas/db"

export const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  username: column.text().unique(),
  name: column.text(),
  bio: column.text().nullable(),
  avatarUrl: column.text().nullable(),
  passwordHash: column.text(),
  createdAt: column.timestamp().default("CURRENT_TIMESTAMP"),
})

export const posts = defineSchema("posts", {
  id: column.serial().primaryKey(),
  userId: column.integer().ref("users", "id"),
  content: column.text(),
  imageUrl: column.text().nullable(),
  createdAt: column.timestamp().default("CURRENT_TIMESTAMP"),
})

export const follows = defineSchema("follows", {
  id: column.serial().primaryKey(),
  followerId: column.integer().ref("users", "id"),
  followingId: column.integer().ref("users", "id"),
  createdAt: column.timestamp().default("CURRENT_TIMESTAMP"),
})

export const likes = defineSchema("likes", {
  id: column.serial().primaryKey(),
  userId: column.integer().ref("users", "id"),
  postId: column.integer().ref("posts", "id"),
  createdAt: column.timestamp().default("CURRENT_TIMESTAMP"),
})

export const media = defineSchema("media", {
  id: column.serial().primaryKey(),
  userId: column.integer().ref("users", "id"),
  key: column.text(),
  url: column.text(),
  contentType: column.text(),
  createdAt: column.timestamp().default("CURRENT_TIMESTAMP"),
})
