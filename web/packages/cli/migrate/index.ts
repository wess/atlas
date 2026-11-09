import { command, flag } from "../command/index.ts";
import { type Deps, runMigrate } from "./run.ts";
import type { Target } from "./target.ts";

// resolved from the consuming project, like mcp: `atlas add migrate db/sqlite` installs them
const load = async (name: string, hint: string): Promise<any> => {
  try {
    return await import(Bun.resolveSync(name, process.cwd()));
  } catch {
    throw new Error(`Cannot load ${name} from this project. Run: atlas add ${hint}`);
  }
};

const realDeps = (): Deps => ({
  connect: async (target: Target) =>
    target.driver === "postgres"
      ? (await load("@wess/atlas/db/postgres", "db/postgres")).connect({ url: target.url })
      : (await load("@wess/atlas/db/sqlite", "db/sqlite")).connect({ path: target.path }),
  up: async (db, dir) => (await load("@wess/atlas/migrate", "migrate")).up(db, dir),
  down: async (db, dir) => (await load("@wess/atlas/migrate", "migrate")).down(db, dir),
  status: async (db, dir) => (await load("@wess/atlas/migrate", "migrate")).status(db, dir),
  create: async (dir, name) => (await load("@wess/atlas/migrate", "migrate")).createMigration(dir, name),
  log: (line) => console.log(line),
});

export const migrateCommand = command("migrate", {
  description: "Run migrations: up | down | status | new <name>",
  flags: {
    dir: flag("d", { type: "string", default: "./migrations", description: "Migrations directory" }),
  },
  run: async ({ args, flags }) => {
    try {
      await runMigrate(args, { dir: String(flags.dir), url: process.env.DATABASE_URL }, realDeps());
    } catch (err) {
      console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  },
});
