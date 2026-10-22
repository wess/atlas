#!/usr/bin/env bun

export async function verify(): Promise<void> {
  const proc = Bun.spawn(["bun", "test", `${import.meta.dir}/test`], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`Distribution verification exited ${code}`);
}

if (import.meta.main) await verify();
