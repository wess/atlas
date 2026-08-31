import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";

export type MigrationFile = {
  readonly name: string;
  readonly timestamp: string;
  readonly upPath: string;
  readonly downPath: string;
};

export const scanMigrations = (dir: string): MigrationFile[] => {
  if (!existsSync(dir)) return [];

  const entries = readdirSync(dir, { withFileTypes: true });

  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
    .filter((name) => {
      const up = `${dir}/${name}/up.sql`;
      const down = `${dir}/${name}/down.sql`;
      return existsSync(up) && existsSync(down);
    })
    .map((name) => ({
      name,
      timestamp: name.split("_")[0] ?? "",
      upPath: `${dir}/${name}/up.sql`,
      downPath: `${dir}/${name}/down.sql`,
    }));
};

export const createMigration = (dir: string, name: string): MigrationFile => {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const dirName = `${timestamp}_${name}`;
  const migrationDir = `${dir}/${dirName}`;

  mkdirSync(migrationDir, { recursive: true });

  Bun.write(`${migrationDir}/up.sql`, "");
  Bun.write(`${migrationDir}/down.sql`, "");

  return {
    name: dirName,
    timestamp,
    upPath: `${migrationDir}/up.sql`,
    downPath: `${migrationDir}/down.sql`,
  };
};

export const readSql = (path: string): string => readFileSync(path, "utf-8");
