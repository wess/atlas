import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

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
  // to the second, so two migrations made the same day still sort in the order they were made
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const dirName = `${timestamp}_${name}`;
  const migrationDir = `${dir}/${dirName}`;

  // never reuse a directory: that would empty SQL someone already wrote
  if (existsSync(migrationDir)) throw new Error(`Migration ${dirName} already exists`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(migrationDir);
  // sync, so the files exist when this returns
  writeFileSync(`${migrationDir}/up.sql`, "", { flag: "wx" });
  writeFileSync(`${migrationDir}/down.sql`, "", { flag: "wx" });

  return {
    name: dirName,
    timestamp,
    upPath: `${migrationDir}/up.sql`,
    downPath: `${migrationDir}/down.sql`,
  };
};

export const readSql = (path: string): string => readFileSync(path, "utf-8");
