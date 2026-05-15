export type { DiffOp, DiffOptions, DiffPlan, DiffWriteResult, LiveColumn, LiveTable } from "./diff/index.ts";
export { plan as diffPlan, writeDiff } from "./diff/index.ts";
export type { MigrationFile } from "./files/index.ts";
export { createMigration, scanMigrations } from "./files/index.ts";
export type { MigrationStatus } from "./migrations/index.ts";
export { down, ensureTable, status, up } from "./migrations/index.ts";

import { plan as diffPlan, writeDiff } from "./diff/index.ts";
import { createMigration } from "./files/index.ts";
import { down, ensureTable, status, up } from "./migrations/index.ts";

export const migrate = {
  up,
  down,
  status,
  create: createMigration,
  ensureTable,
  diff: writeDiff,
  plan: diffPlan,
};
