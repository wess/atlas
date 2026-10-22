import { column, defineSchema } from "@wess/atlas/db/query";

export const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  name: column.text(),
  created: column.timestamp(),
})
