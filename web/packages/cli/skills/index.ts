import { join } from "node:path";
import { command, flag } from "../command/index.ts";

// packages/cli/skills/index.ts → the source or installed package root
const SKILLS_DIR = new URL("../../../skills", import.meta.url).pathname;

type Skill = { name: string; description: string; body: string };

const descriptionOf = (body: string) => body.match(/^description: (.*)$/m)?.[1] ?? "";

export const listSkills = async (dir = SKILLS_DIR): Promise<Skill[]> => {
  const paths = [...new Bun.Glob("*/SKILL.md").scanSync({ cwd: dir })].sort();
  return Promise.all(
    paths.map(async (path) => {
      const body = await Bun.file(join(dir, path)).text();
      return { name: path.split("/")[0]!, description: descriptionOf(body), body };
    }),
  );
};

export const installSkills = async (
  skills: Skill[],
  names: string[],
  destination: string,
): Promise<{ installed: string[]; unknown: string[] }> => {
  const known = new Set(skills.map((skill) => skill.name));
  const unknown = names.filter((name) => !known.has(name));
  if (unknown.length > 0) return { installed: [], unknown };
  const chosen = names.length > 0 ? skills.filter((skill) => names.includes(skill.name)) : skills;
  await Promise.all(chosen.map((skill) => Bun.write(join(destination, skill.name, "SKILL.md"), skill.body)));
  return { installed: chosen.map((skill) => skill.name), unknown: [] };
};

const printIndex = (skills: Skill[]) => {
  process.stdout.write("Atlas skills (atlas skills <name>, atlas skills install [names] [--dir path]):\n\n");
  for (const skill of skills) process.stdout.write(`  ${skill.name.padEnd(18)} ${skill.description.split(".")[0]}\n`);
};

export const skillsCommand = command("skills", {
  description: "List, print, or install agent skills for building with Atlas",
  flags: {
    dir: flag("d", { type: "string", default: ".claude/skills", description: "Where to install skills" }),
  },
  run: async ({ args, flags }) => {
    const skills = await listSkills();
    const [target, ...rest] = args;
    if (!target) {
      printIndex(skills);
      return;
    }
    if (target === "install") {
      const destination = flags.dir as string;
      const { installed, unknown } = await installSkills(skills, rest, destination);
      if (unknown.length > 0) {
        process.stderr.write(`Unknown skill: ${unknown.join(", ")}\n\n`);
        printIndex(skills);
        process.exit(1);
      }
      process.stdout.write(`Installed ${installed.length} skills in ${destination}\n`);
      return;
    }
    const skill = skills.find((entry) => entry.name === target);
    if (!skill) {
      process.stderr.write(`Unknown skill: "${target}"\n\n`);
      printIndex(skills);
      process.exit(1);
    }
    process.stdout.write(skill.body);
  },
});
