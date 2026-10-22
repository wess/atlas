import { join } from "node:path";

export async function smokeFixture(directory: string, example = false, admin = false): Promise<void> {
  const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response(null) });
  const port = probe.port!;
  await probe.stop(true);
  const secret = crypto.randomUUID() + crypto.randomUUID();
  const child = Bun.spawn([process.execPath, "--no-env-file", example ? "src/server.ts" : "server.ts"], {
    cwd: directory,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      PORT: String(port),
      HOST: "127.0.0.1",
      SECRET: secret,
      AUTH_SECRET: secret,
      DATABASE_PATH: join(directory, "smoke.db"),
    },
  });
  const stdout = new Response(child.stdout).text();
  const stderr = new Response(child.stderr).text();
  const origin = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error("Fixture server exited before accepting HTTP");
      try {
        const response = await fetch(origin + (example ? "/" : "/health"), { signal: AbortSignal.timeout(500) });
        await response.arrayBuffer();
        if (response.status !== 200) throw new Error(`Fixture health returned ${response.status}`);
        ready = true;
        break;
      } catch (error) {
        if (attempt === 99) throw error;
        await Bun.sleep(50);
      }
    }
    if (!ready) throw new Error("Fixture server did not become ready");
    if (admin) {
      const endpoint = `${origin}/admin/api/schema`;
      const denied = await fetch(endpoint);
      if (denied.status !== 401) throw new Error(`Anonymous admin returned ${denied.status}`);
      const signing = await import(Bun.resolveSync("@wess/atlas/auth/token", directory));
      for (const [role, status] of [
        ["user", 403],
        ["admin", 200],
      ] as const) {
        const token = await signing.sign({ role }, secret);
        const response = await fetch(endpoint, { headers: { authorization: `Bearer ${token}` } });
        await response.arrayBuffer();
        if (response.status !== status) throw new Error(`Admin role ${role} returned ${response.status}`);
      }
    }
    if (example) {
      const send = (path: string, body: unknown, token?: string) =>
        fetch(origin + path, {
          method: "POST",
          headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(body),
        });
      const signup = await send("/api/signup", {
        handle: "check",
        email: "check@example.test",
        password: "local-fixture-password",
      });
      if (signup.status !== 201) throw new Error(`Example signup returned ${signup.status}`);
      const login = await send("/api/login", { email: "check@example.test", password: "local-fixture-password" });
      if (login.status !== 200) throw new Error(`Example login returned ${login.status}`);
      const { token } = (await login.json()) as { token: string };
      const created = await send("/api/posts", { content: "packed release check" }, token);
      if (created.status !== 201) throw new Error(`Example post returned ${created.status}`);
      const { id } = (await created.json()) as { id: number };
      const read = await fetch(`${origin}/api/posts/${id}`, { headers: { authorization: `Bearer ${token}` } });
      if (read.status !== 200 || ((await read.json()) as { content: string }).content !== "packed release check") {
        throw new Error("Example post round-trip failed");
      }
      const denied = await send("/api/login", { email: "check@example.test", password: "wrong-password" });
      if (denied.status !== 401) throw new Error(`Example wrong password returned ${denied.status}`);
    }
  } finally {
    child.kill("SIGTERM");
    await child.exited;
    await Bun.write(join(directory, "smoke.log"), (await stdout) + (await stderr));
  }
}
