import type { ConflictSpec, Query } from "../types/index.ts";

export const setOnConflict = (query: Query, spec: ConflictSpec): Query => ({
  ...query,
  conflict: spec,
});
