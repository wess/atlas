import { command } from "../command/index.ts";

const PACKAGES: Record<string, string> = {
  config: "@atlas/config",
  db: "@atlas/db",
  server: "@atlas/server",
  auth: "@atlas/auth",
  storage: "@atlas/storage",
  cache: "@atlas/cache",
  request: "@atlas/request",
  migrate: "@atlas/migrate",
  cli: "@atlas/cli",
  ui: "@atlas/ui",
  admin: "@atlas/admin",
};

export const addCommand = command("add", {
  description: "Add Atlas packages to your project",
  run: async (args) => {
    const packages = args.args.map((name) => {
      const resolved = PACKAGES[name] ?? name;
      if (!resolved.startsWith("@atlas/")) {
        console.error(`Unknown package: ${name}`);
        console.log(`Available: ${Object.keys(PACKAGES).join(", ")}`);
        process.exit(1);
      }
      return resolved;
    });

    if (packages.length === 0) {
      console.log("Usage: atlas add <package> [package...]");
      console.log(`\nAvailable packages:`);
      for (const [short, full] of Object.entries(PACKAGES)) {
        console.log(`  ${short.padEnd(12)} ${full}`);
      }
      return;
    }

    console.log(`Installing: ${packages.join(", ")}`);
    const proc = Bun.spawn(["bun", "add", ...packages], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await proc.exited;
  },
});
