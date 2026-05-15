import { existsSync, mkdirSync } from "node:fs";
import { command, flag } from "../command/index.ts";
import type { Answers } from "./questions.ts";
import { applyDefaults, askQuestions } from "./questions.ts";
import { generateProject, scaffoldFromTemplate } from "./templates.ts";

export const initCommand = command("init", {
  description: "Create a new Atlas project",
  flags: {
    yes: flag("y", { type: "boolean", default: false, description: "Use defaults, skip prompts" }),
    name: flag("n", { type: "string", description: "Project name" }),
    template: flag("t", { type: "string", description: "Project template" }),
  },
  run: async (args) => {
    console.log("\nAtlas — New Project\n");

    const templateFlag = args.flags.template as string | undefined;

    let answers: Answers;
    if (args.flags.yes) {
      const partial: Partial<Answers> = {};
      if (args.flags.name) partial.name = args.flags.name as string;
      if (templateFlag) partial.template = templateFlag;
      answers = applyDefaults(partial);
    } else if (templateFlag) {
      // Template provided via flag, just ask for name
      answers = applyDefaults({
        template: templateFlag,
        name: (args.flags.name as string) || undefined,
      });
      if (!args.flags.name) {
        // Still need to ask for the project name
        const stdin = Bun.stdin.stream();
        const reader = stdin.getReader();
        const decoder = new TextDecoder();
        process.stdout.write(`Project name (my-app): `);
        const { value } = await reader.read();
        const input = decoder.decode(value).trim();
        answers.name = input || "my-app";
        reader.releaseLock();
      }
    } else {
      answers = await askQuestions();
    }

    const projectName = answers.name as string;
    const projectDir = `./${projectName}`;
    if (existsSync(projectDir)) {
      console.error(`Directory ${projectDir} already exists`);
      process.exit(1);
    }

    const template = answers.template as string | undefined;

    if (template && template !== "custom") {
      mkdirSync(projectDir, { recursive: true });
      await scaffoldFromTemplate(template, projectDir, projectName);
    } else {
      const files = generateProject(answers);

      mkdirSync(projectDir, { recursive: true });
      for (const file of files) {
        const fullPath = `${projectDir}/${file.path}`;
        const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
        if (dir !== projectDir) mkdirSync(dir, { recursive: true });
        await Bun.write(fullPath, file.content);
        console.log(`  created ${file.path}`);
      }
    }

    console.log(`\nProject created at ${projectDir}\n`);
    console.log(`Next steps:`);
    console.log(`  cd ${projectName}`);
    console.log(`  bun install`);
    console.log(`  atlas dev\n`);
  },
});
