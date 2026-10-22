import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tagRevision, uploadRelease } from "../release.ts";

const commit = "a".repeat(40);
const names = ["catalog.json", "wess-atlas-server-0.4.0.tgz"];

const fixture = async (options: { draft?: boolean; assets?: string[]; corrupt?: boolean; revision?: string } = {}) => {
  const directory = await mkdtemp(join(tmpdir(), "atlasreleasetest"));
  for (const name of names) await Bun.write(join(directory, name), `tested ${name}`);
  const calls: string[][] = [];
  const command = async (args: string[]): Promise<string | undefined> => {
    calls.push(args);
    if (args[0] === "api" && args[1]?.includes("/git/ref/tags/"))
      return options.revision ? JSON.stringify({ object: { type: "commit", sha: options.revision } }) : undefined;
    if (args[0] === "api" && args[1]?.includes("/releases/tags/")) {
      return options.draft === undefined
        ? undefined
        : JSON.stringify({ draft: options.draft, assets: (options.assets ?? []).map((name) => ({ name })) });
    }
    if (args[0] === "release" && args[1] === "download") {
      const name = args[args.indexOf("--pattern") + 1]!;
      const target = args[args.indexOf("--dir") + 1]!;
      await Bun.write(join(target, name), options.corrupt ? "changed bytes" : Bun.file(join(directory, name)));
    }
    return "";
  };
  return {
    calls,
    run: () => uploadRelease(directory, "0.4.0", names, commit, command),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
};

test("a new release stays draft until every uploaded file is downloaded and verified", async () => {
  const f = await fixture();
  try {
    await f.run();
    const operations = f.calls.filter((args) => args[0] === "release").map((args) => args[1]);
    expect(operations).toEqual(["create", "upload", "download", "upload", "download", "edit"]);
    expect(f.calls.find((args) => args[1] === "create")).toContain("--draft");
    expect(f.calls.some((args) => args.includes("--clobber"))).toBe(false);
  } finally {
    await f.cleanup();
  }
});

test("a partial draft resumes without replacing an existing asset", async () => {
  const f = await fixture({ draft: true, assets: [names[0]!], revision: commit });
  try {
    await f.run();
    const uploads = f.calls.filter((args) => args[1] === "upload");
    expect(uploads).toHaveLength(1);
    expect(uploads[0]?.[3]).toEndWith(names[1]!);
  } finally {
    await f.cleanup();
  }
});

test("a complete public release is verified without mutation", async () => {
  const f = await fixture({ draft: false, assets: names, revision: commit });
  try {
    await f.run();
    expect(f.calls.filter((args) => args[0] === "release").map((args) => args[1])).toEqual(["download", "download"]);
  } finally {
    await f.cleanup();
  }
});

test("a mismatched asset cannot be replaced or published", async () => {
  const f = await fixture({ draft: true, assets: [names[0]!], corrupt: true, revision: commit });
  try {
    await expect(f.run()).rejects.toThrow("differs from tested bytes");
    expect(f.calls.some((args) => args[1] === "upload" || args[1] === "edit")).toBe(false);
  } finally {
    await f.cleanup();
  }
});

test("an existing tag cannot move to another tested commit", async () => {
  const f = await fixture({ revision: "b".repeat(40) });
  try {
    await expect(f.run()).rejects.toThrow("another commit");
    expect(f.calls).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});

test("an incomplete public release cannot gain replacement assets", async () => {
  const f = await fixture({ draft: false, assets: [], revision: commit });
  try {
    await expect(f.run()).rejects.toThrow("refusing to modify");
    expect(f.calls.some((args) => args[0] === "release")).toBe(false);
  } finally {
    await f.cleanup();
  }
});

test("annotated release tags resolve to their commit", async () => {
  const revision = await tagRevision("v0.4.0", async (args) =>
    JSON.stringify({ object: { type: args[1]?.includes("/git/ref/") ? "tag" : "commit", sha: commit } }),
  );
  expect(revision).toBe(commit);
});
