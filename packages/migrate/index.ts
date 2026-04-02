export type { MigrationFile } from "./files/index.ts";
export { createMigration, scanMigrations } from "./files/index.ts";
export type { MigrationStatus } from "./migrations/index.ts";
export { down, ensureTable, status, up } from "./migrations/index.ts";

import { createMigration } from "./files/index.ts";
import { down, ensureTable, status, up } from "./migrations/index.ts";

export const migrate = { up, down, status, create: createMigration, ensureTable };
