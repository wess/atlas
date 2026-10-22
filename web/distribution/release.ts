import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Catalog } from "./build.ts";
import { verifyCatalog } from "./publish.ts";

type Gh = (args: string[]) => Promise<string | undefined>;
type Release = { draft: boolean; assets: { name: string }[] };
const repository = "wess/atlas";
const digest = async (path: string): Promise<string> =>
  new Bun.CryptoHasher("sha512").update(await Bun.file(path).arrayBuffer()).digest("hex");

const gh: Gh = async (args) => {
  for (let attempt = 0; ; attempt++) {
    const child = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    if (code === 0) return stdout;
    if (/HTTP 404/.test(stderr)) return undefined;
    // the release API can lag behind a successfully created tag reference
    if (attempt < 4 && args[0] === "release" && args[1] === "create" && stderr.includes("--verify-tag")) {
      await Bun.sleep(1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`GitHub release command failed: ${stderr}`);
  }
};

export async function tagRevision(tag: string, command: Gh = gh): Promise<string | undefined> {
  const ref = await command(["api", `repos/${repository}/git/ref/tags/${tag}`]);
  if (ref === undefined) return undefined;
  let object: { type: string; sha: string } = JSON.parse(ref).object;
  for (let depth = 0; depth < 8; depth++) {
    if (object.type === "commit") return object.sha;
    if (object.type !== "tag") break;
    const annotated = await command(["api", `repos/${repository}/git/tags/${object.sha}`]);
    if (annotated === undefined) break;
    object = JSON.parse(annotated).object;
  }
  throw new Error(`Cannot resolve release tag ${tag} to a commit`);
}

export async function uploadRelease(
  directory: string,
  version: string,
  names: string[],
  commit: string,
  command: Gh = gh,
): Promise<void> {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^[a-f0-9]{40}$/.test(commit))
    throw new Error("A stable version and exact tested commit are required");
  if (names.some((name) => !/^(?:catalog\.json|wess-atlas(?:-[a-z]+)?-\d+\.\d+\.\d+\.tgz)$/.test(name)))
    throw new Error("Unexpected release asset path");
  const tag = `v${version}`;
  const api = `repos/${repository}`;
  const checked = async (args: string[]): Promise<string> => {
    const result = await command(args);
    if (result === undefined) throw new Error(`Missing GitHub resource: ${args.join(" ")}`);
    return result;
  };
  const revision = await tagRevision(tag, command);
  if (revision !== undefined && revision.trim() !== commit)
    throw new Error(`${tag} belongs to another commit; bump the version instead`);
  const existing = await command(["api", `${api}/releases/tags/${tag}`]);
  let release: Release | undefined = existing === undefined ? undefined : JSON.parse(existing);
  if (release && revision === undefined) throw new Error(`Release ${tag} has no verifiable tag`);
  if (!release) {
    if (revision === undefined) {
      await checked([
        "api",
        `${api}/git/refs`,
        "--method",
        "POST",
        "-f",
        `ref=refs/tags/${tag}`,
        "-f",
        `sha=${commit}`,
      ]);
    }
    await checked([
      "release",
      "create",
      tag,
      "--repo",
      repository,
      "--verify-tag",
      "--draft",
      "--generate-notes",
      "--title",
      tag,
    ]);
    release = { draft: true, assets: [] };
  }
  const unexpected = release.assets.filter((asset) => !names.includes(asset.name));
  if (unexpected.length) throw new Error(`Unexpected assets already exist on ${tag}`);
  const temporary = await mkdtemp(join(tmpdir(), "atlasrelease"));
  try {
    // check every existing byte before uploading anything; retries never replace assets
    for (const asset of release.assets) {
      await checked(["release", "download", tag, "--repo", repository, "--pattern", asset.name, "--dir", temporary]);
      if ((await digest(join(temporary, asset.name))) !== (await digest(join(directory, asset.name))))
        throw new Error(`Release asset differs from tested bytes: ${asset.name}`);
    }
    const missing = names.filter((name) => !release.assets.some((asset) => asset.name === name));
    if (!release.draft && missing.length) throw new Error(`Published ${tag} is incomplete; refusing to modify it`);
    for (const name of missing) {
      await checked(["release", "upload", tag, join(directory, name), "--repo", repository]);
      await checked(["release", "download", tag, "--repo", repository, "--pattern", name, "--dir", temporary]);
      if ((await digest(join(temporary, name))) !== (await digest(join(directory, name))))
        throw new Error(`Uploaded release asset differs: ${name}`);
    }
    if (release.draft) await checked(["release", "edit", tag, "--repo", repository, "--draft=false"]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  console.log(`${tag}: all ${names.length} GitHub assets verified`);
}

if (import.meta.main) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REPOSITORY !== repository)
    throw new Error("Release uploads run only in this repository's Actions workflow");
  const directory = resolve(Bun.argv[2] ?? "out/distribution");
  await verifyCatalog(directory);
  const catalog: Catalog = await Bun.file(join(directory, "catalog.json")).json();
  await uploadRelease(
    directory,
    catalog.version,
    ["catalog.json", ...Object.values(catalog.packages).map((pkg) => pkg.tarball!)],
    process.env.GITHUB_SHA ?? "",
  );
}
