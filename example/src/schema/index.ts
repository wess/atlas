import { defineSchema, column } from "@atlas/db"

export const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  handle: column.text().unique(),
  email: column.text().unique(),
  password: column.text(),
  bio: column.text().nullable(),
  createdAt: column.timestamp().default("now()"),
})

export const posts = defineSchema("posts", {
  id: column.serial().primaryKey(),
  userId: column.integer().ref("users", "id"),
  content: column.text(),
  createdAt: column.timestamp().default("now()"),
})

export const follows = defineSchema("follows", {
  id: column.serial().primaryKey(),
  followerId: column.integer().ref("users", "id"),
  followingId: column.integer().ref("users", "id"),
  createdAt: column.timestamp().default("now()"),
})

export const likes = defineSchema("likes", {
  id: column.serial().primaryKey(),
  userId: column.integer().ref("users", "id"),
  postId: column.integer().ref("posts", "id"),
  createdAt: column.timestamp().default("now()"),
})
