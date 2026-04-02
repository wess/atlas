import type { Query } from "../types/index.ts";

export const setUpdate = (query: Query, data: Record<string, any>): Query => ({
  ...query,
  type: "update",
  values: { ...data },
});
