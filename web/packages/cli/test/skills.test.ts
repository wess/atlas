import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { installSkills, listSkills } from "../skills/index.ts";

const root = resolve(import.meta.dir, "../../..");
const skills = await listSkills();
const temporary: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "atlasskills"));
  temporary.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// a skill exists to save context, so an oversized one has defeated its purpose
const budgetBytes = 8 * 1024;

test("the entry skill routes to a skill that exists, and every skill is reachable from it", () => {
  const entry = skills.find((skill) => skill.name === "atlas")!;
  const routed = [...entry.body.matchAll(/`(atlas[a-z]+)`/g)].map((match) => match[1]!);
  const names = skills.map((skill) => skill.name);
  for (const name of routed) expect(names).toContain(name);
  for (const name of names.filter((name) => name !== "atlas")) expect(routed).toContain(name);
});

for (const skill of skills) {
  test(`${skill.name} is well formed and within budget`, () => {
    expect(skill.name).toMatch(/^[a-z]+$/);
    expect(skill.body).toMatch(new RegExp(`^---\\nname: ${skill.name}\\ndescription: `));
    expect(skill.description).toContain("Use ");
    expect(skill.description.length).toBeLessThan(300);
    expect(Buffer.byteLength(skill.body)).toBeLessThan(budgetBytes);
  });

  test(`${skill.name} only names real modules and current versions`, async () => {
    const manifest = await Bun.file(join(root, "package.json")).json();
    const exportsMap = Object.keys(manifest.exports);
    for (const match of skill.body.matchAll(/@wess\/atlas\/([a-z]+(?:\/[a-z.]+)?)/g)) {
      const entry = `./${match[1]}`;
      const wildcard = exportsMap.includes("./ui/*") && /^\.\/ui\/[a-z]+$/.test(entry);
      expect(exportsMap.includes(entry) || wildcard).toBe(true);
    }
    for (const match of skill.body.matchAll(/download\/v([0-9.]+)\/wess-atlas-[a-z]+-([0-9.]+)\.tgz/g)) {
      expect(match[1]).toBe(manifest.version);
      expect(match[2]).toBe(manifest.version);
    }
    expect(skill.body).not.toMatch(/mantine/i);
  });
}

test("installing copies every skill by default", async () => {
  const destination = scratch();
  const { installed } = await installSkills(skills, [], destination);
  expect(installed.length).toBe(skills.length);
  expect(readdirSync(destination).sort()).toEqual(skills.map((skill) => skill.name).sort());
  expect(await Bun.file(join(destination, "atlas/SKILL.md")).text()).toContain("name: atlas");
});

test("installing can select skills, and an unknown name writes nothing", async () => {
  const destination = scratch();
  expect((await installSkills(skills, ["atlasdb"], destination)).installed).toEqual(["atlasdb"]);
  expect(readdirSync(destination)).toEqual(["atlasdb"]);
  const other = scratch();
  expect((await installSkills(skills, ["atlasdb", "nope"], other)).unknown).toEqual(["nope"]);
  expect(readdirSync(other)).toEqual([]);
});
