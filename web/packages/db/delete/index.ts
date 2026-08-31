import type { Query } from "../types/index.ts";

export const setDelete = (query: Query): Query => ({
  ...query,
  type: "delete",
});
