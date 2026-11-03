import { createConfiguredNotifier, type NotifyConfig, type NotifyMessage, type NotifyResult } from "./notify";

export type NotifySubprocessOptions = {
  readonly config: NotifyConfig;
  readonly bun?: string;
};

export type NotifySubprocess = {
  readonly send: (message: NotifyMessage) => Promise<NotifyResult>;
  readonly sendMany: (messages: readonly NotifyMessage[]) => Promise<readonly NotifyResult[]>;
  readonly close: () => Promise<void>;
};

type WorkerRequest =
  | { readonly type: "config"; readonly config: NotifyConfig }
  | { readonly type: "send"; readonly id: number; readonly message: NotifyMessage };

type WorkerResponse = { readonly id: number; readonly result: NotifyResult };

const consumeLines = async (stream: ReadableStream<Uint8Array>, consume: (line: string) => void): Promise<void> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) consume(line);
    if (done) break;
  }
  if (pending.trim()) consume(pending);
};

export const createNotifySubprocess = (options: NotifySubprocessOptions): NotifySubprocess => {
  const child = Bun.spawn([options.bun ?? process.execPath, import.meta.path, "--atlas-notify-worker"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
  });
  let nextId = 0;
  let closed = false;
  const pending = new Map<number, { resolve: (result: NotifyResult) => void }>();
  const write = (value: WorkerRequest): void => {
    child.stdin.write(`${JSON.stringify(value)}\n`);
    child.stdin.flush();
  };
  write({ type: "config", config: options.config });

  void consumeLines(child.stdout, (line) => {
    const response = JSON.parse(line) as WorkerResponse;
    pending.get(response.id)?.resolve(response.result);
    pending.delete(response.id);
  });
  void child.exited.then((code) => {
    for (const { resolve } of pending.values()) {
      resolve({ ok: false, provider: "subprocess", error: `Notify subprocess exited with code ${code}` });
    }
    pending.clear();
  });

  const send = (message: NotifyMessage): Promise<NotifyResult> => {
    if (closed) return Promise.resolve({ ok: false, provider: message.to.kind, error: "Notify subprocess is closed" });
    const id = ++nextId;
    return new Promise((resolve) => {
      pending.set(id, { resolve });
      write({ type: "send", id, message });
    });
  };

  return {
    send,
    sendMany: (messages) => Promise.all(messages.map(send)),
    close: async () => {
      if (closed) return;
      closed = true;
      child.stdin.end();
      await child.exited;
    },
  };
};

const runWorker = async (): Promise<void> => {
  let notifier: ReturnType<typeof createConfiguredNotifier> | undefined;
  await consumeLines(Bun.stdin.stream(), (line) => {
    const request = JSON.parse(line) as WorkerRequest;
    if (request.type === "config") {
      notifier = createConfiguredNotifier(request.config);
      return;
    }
    const current = notifier;
    if (!current) throw new Error("Notify worker received a message before configuration");
    void current.send(request.message).then((result) => {
      process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
    });
  });
};

if (import.meta.main && Bun.argv.includes("--atlas-notify-worker")) await runWorker();
