// skills are read instead of the source, so a wrong snippet costs more than no snippet at all.
// every ts and tsx block is compiled against the real packages.
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const out = join(root, "out/skillcheck");

// names a snippet may assume its surrounding app already has
const ambient = `
import type { Connection } from "${root}/packages/db/query.ts";
import type { AiProvider } from "${root}/packages/ai/index.ts";
import type { users as Users, posts as Posts } from "${root}/out/skillcheck/schema.ts";
declare global {
  const db: Connection;
  const secret: string;
  const ai: AiProvider;
  const users: typeof Users;
  const posts: typeof Posts;
}
export {};
`;
const schema = `
import { column, defineSchema } from "${root}/packages/db/index.ts";
export const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text().unique(),
  bio: column.text().nullable(),
  active: column.boolean().default(true),
  role: column.text(),
  passwordHash: column.text(),
  created: column.timestamp(),
});
export const posts = defineSchema("posts", { id: column.serial().primaryKey(), title: column.text() });
`;

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await Bun.write(join(out, "ambient.d.ts"), ambient);
await Bun.write(join(out, "schema.ts"), schema);
// css is verified by the packed fixtures; tsc can't resolve a stylesheet through the source alias
await Bun.write(join(out, "css.d.ts"), 'declare module "@wess/atlas/ui/styles.css";\n');

let count = 0;
for (const path of new Bun.Glob("*/SKILL.md").scanSync({ cwd: join(root, "skills") })) {
  const name = path.split("/")[0]!;
  const body = await Bun.file(join(root, "skills", path)).text();
  for (const match of body.matchAll(/```(tsx?)\n([\s\S]*?)```/g)) {
    count += 1;
    const source =
      match[2]!.includes("export ") || match[2]!.includes("import ") ? match[2]! : `${match[2]}\nexport {};`;
    await Bun.write(join(out, `${name}${count}.${match[1]}`), source);
  }
}

await Bun.write(
  join(out, "tsconfig.json"),
  JSON.stringify({ extends: "../../tsconfig.json", include: ["./*.ts", "./*.tsx"], exclude: [] }),
);
const check = Bun.spawn(["bunx", "tsc", "--noEmit", "-p", join(out, "tsconfig.json")], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
});
if ((await check.exited) !== 0) {
  console.error(`Skill snippets failed to typecheck. Generated files are in ${out}`);
  process.exit(1);
}
await rm(out, { recursive: true, force: true });
console.log(`Typechecked ${count} skill snippets`);
