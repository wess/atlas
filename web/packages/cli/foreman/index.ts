const COLORS = [
  "\x1b[36m", // cyan
  "\x1b[33m", // yellow
  "\x1b[32m", // green
  "\x1b[35m", // magenta
  "\x1b[34m", // blue
  "\x1b[31m", // red
];
const RESET = "\x1b[0m";

export type ProcSpec = Record<string, string>;

export const parseProcfile = (content: string): ProcSpec => {
  const procs: ProcSpec = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const name = trimmed.slice(0, colonIdx).trim();
    const cmd = trimmed.slice(colonIdx + 1).trim();
    procs[name] = cmd;
  }
  return procs;
};

const pipeOutput = async (stream: ReadableStream<Uint8Array> | null, prefix: string) => {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer) console.log(`${prefix} ${buffer}`);
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line) console.log(`${prefix} ${line}`);
    }
  }
};

export const foreman = async (procs: ProcSpec | string): Promise<void> => {
  let specs: ProcSpec;
  if (typeof procs === "string") {
    const content = await Bun.file(procs).text();
    specs = parseProcfile(content);
  } else {
    specs = procs;
  }

  const entries = Object.entries(specs);
  if (entries.length === 0) return;

  const maxNameLen = Math.max(...entries.map(([n]) => n.length));
  const processes: ReturnType<typeof Bun.spawn>[] = [];

  entries.forEach(([name, cmd], i) => {
    const color = COLORS[i % COLORS.length]!;
    const prefix = `${color}${name.padEnd(maxNameLen)}${RESET} |`;

    const parts = cmd.split(" ");
    const proc = Bun.spawn(parts, {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });

    processes.push(proc);

    pipeOutput(proc.stdout, prefix);
    pipeOutput(proc.stderr, prefix);
  });

  const shutdown = () => {
    for (const proc of processes) {
      proc.kill();
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await Promise.all(processes.map((p) => p.exited));
};
