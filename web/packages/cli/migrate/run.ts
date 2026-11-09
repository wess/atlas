import { checkName, parseTarget, type Target } from "./target.ts";

type Db = { close(): Promise<void> };
type Status = { name: string; appliedAt: Date | null };

export type Deps = {
  readonly connect: (target: Target) => Promise<Db>;
  readonly up: (db: any, dir: string) => Promise<string[]>;
  readonly down: (db: any, dir: string) => Promise<string | null>;
  readonly status: (db: any, dir: string) => Promise<Status[]>;
  readonly create: (dir: string, name: string) => Promise<{ name: string }> | { name: string };
  readonly log: (line: string) => void;
};

export const actions = ["up", "down", "status", "new"] as const;
export const usage = "Usage: atlas migrate <up|down|status|new <name>> [--dir ./migrations]";

export const runMigrate = async (args: string[], opts: { dir: string; url?: string }, deps: Deps): Promise<void> => {
  const [action, name] = args;
  if (!action || !(actions as readonly string[]).includes(action)) {
    throw new Error(action ? `Unknown migrate action "${action}". ${usage}` : usage);
  }

  if (action === "new") {
    const made = await deps.create(opts.dir, checkName(name));
    deps.log(`✔ created ${made.name} in ${opts.dir}`);
    return;
  }

  const db = await deps.connect(parseTarget(opts.url));
  try {
    if (action === "up") {
      const ran = await deps.up(db, opts.dir);
      deps.log(ran.length ? ran.map((n) => `✔ applied ${n}`).join("\n") : "→ nothing to apply");
    } else if (action === "down") {
      const rolled = await deps.down(db, opts.dir);
      deps.log(rolled ? `✔ rolled back ${rolled}` : "→ nothing to roll back");
    } else {
      const rows = await deps.status(db, opts.dir);
      deps.log(
        rows.length
          ? rows.map((r) => `${r.appliedAt ? "applied" : "pending"}  ${r.name}`).join("\n")
          : "→ no migrations found",
      );
    }
  } finally {
    await db.close();
  }
};
