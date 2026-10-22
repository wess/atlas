import { command } from "../command/index.ts";
import { availableModules, moduleDependencies } from "../modules/index.ts";

export const addCommand = command("add", {
  description: "Install selected Atlas library modules",
  run: async (args) => {
    if (args.args.length === 0) {
      console.log(`Usage: atlas add <module> [module...]\nAvailable: ${availableModules.join(", ")}`);
      return;
    }
    const dependencies = moduleDependencies(args.args);
    const packages = Object.entries(dependencies).map(([name, version]) => `${name}@${version}`);
    console.log(`Installing ${packages.join(", ")}`);
    const proc = Bun.spawn(["bun", "add", "--exact", ...packages], { stdout: "inherit", stderr: "inherit" });
    const code = await proc.exited;
    if (code !== 0) throw new Error(`Package installation failed (${code})`);
  },
});
