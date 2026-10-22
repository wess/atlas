import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { files } from "../files/index.ts";

const ctx = { remoteIp: "127.0.0.1", tls: false, host: "localhost" };

test("static files handle relative roots, URL escapes, HEAD, and symlink boundaries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "atlasfiles"));
  const root = join(dir, "public");
  await mkdir(root);
  await Bun.write(join(root, "hello world.txt"), "public");
  await Bun.write(join(dir, "secret.txt"), "private");
  await Bun.write(join(root, ".env"), "private");
  await symlink(join(dir, "secret.txt"), join(root, "leak.txt"));
  const handler = files({ root });
  try {
    expect(await (await handler(new Request("http://localhost/hello%20world.txt"), ctx)).text()).toBe("public");
    expect((await handler(new Request("http://localhost/leak.txt"), ctx)).status).toBe(404);
    expect((await handler(new Request("http://localhost/.env"), ctx)).status).toBe(404);
    expect((await handler(new Request("http://localhost/..%2fsecret.txt"), ctx)).status).toBe(404);
    expect((await handler(new Request("http://localhost/%00.txt"), ctx)).status).toBe(404);
    expect((await handler(new Request("http://localhost/%zz"), ctx)).status).toBe(404);
    const head = await handler(new Request("http://localhost/hello%20world.txt", { method: "HEAD" }), ctx);
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect((await handler(new Request("http://localhost/hello%20world.txt", { method: "POST" }), ctx)).status).toBe(
      405,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the default relative root serves files", async () => {
  const handler = files({ root: "." });
  const res = await handler(new Request("http://localhost/package.json"), ctx);
  expect(res.status).toBe(200);
  expect((await res.json()).name).toBe("@wess/atlas");
});
