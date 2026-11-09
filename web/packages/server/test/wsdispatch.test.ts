import { expect, test } from "bun:test";
import { serve } from "../router/index.ts";
import { channel } from "../ws/index.ts";

const connect = (port: number, headers?: Record<string, string>) =>
  new Promise<WebSocket>((resolve, reject) => {
    const sock = new WebSocket(`ws://localhost:${port}`, { headers } as any);
    sock.onopen = () => resolve(sock);
    sock.onerror = reject;
  });

const closed = (sock: WebSocket) =>
  new Promise<number>((resolve) => {
    sock.onclose = (e) => resolve(e.code);
  });

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

test("an async handler that rejects closes the socket with 1011 instead of crashing", async () => {
  const errors: unknown[] = [];
  const chat = channel("chat", {
    handle: async (_ws, _ev, payload: any) => {
      payload.text.trim();
    },
  });
  const server = serve({
    port: 0,
    routes: [],
    websocket: { channels: [chat], onError: (e: unknown) => errors.push(e) },
  });
  try {
    const sock = await connect(server.port!);
    const code = closed(sock);
    sock.send(JSON.stringify({ channel: "chat", event: "msg" }));
    expect(await code).toBe(1011);
    expect(errors.length).toBe(1);
    expect(errors[0]).toBeInstanceOf(TypeError);
  } finally {
    server.stop(true);
  }
});

test("a rejecting join closes with 1011", async () => {
  const errors: unknown[] = [];
  const chat = channel("chat", {
    join: async () => {
      throw new Error("db down");
    },
  });
  const server = serve({
    port: 0,
    routes: [],
    websocket: { channels: [chat], onError: (e: unknown) => errors.push(e) },
  });
  try {
    const sock = await connect(server.port!);
    const code = closed(sock);
    sock.send(JSON.stringify({ channel: "chat", event: "join" }));
    expect(await code).toBe(1011);
    expect(errors.length).toBe(1);
  } finally {
    server.stop(true);
  }
});

test("handle only runs after join returned true", async () => {
  const handled: string[] = [];
  const chat = channel("chat", {
    join: async (_ws, params) => params.token === "ok",
    handle: (_ws, event) => {
      handled.push(event);
    },
  });
  const server = serve({ port: 0, routes: [], websocket: { channels: [chat] } });
  try {
    const sock = await connect(server.port!);
    sock.send(JSON.stringify({ channel: "chat", event: "before" }));
    sock.send(JSON.stringify({ channel: "chat", event: "join", payload: { token: "bad" } }));
    await tick();
    sock.send(JSON.stringify({ channel: "chat", event: "refused" }));
    sock.send(JSON.stringify({ channel: "chat", event: "join", payload: { token: "ok" } }));
    await tick();
    sock.send(JSON.stringify({ channel: "chat", event: "admitted" }));
    await tick();
    expect(handled).toEqual(["admitted"]);
    sock.close();
  } finally {
    server.stop(true);
  }
});

test("leave revokes admission", async () => {
  const handled: string[] = [];
  const chat = channel("chat", {
    join: () => true,
    leave: () => {},
    handle: (_ws, event) => {
      handled.push(event);
    },
  });
  const server = serve({ port: 0, routes: [], websocket: { channels: [chat] } });
  try {
    const sock = await connect(server.port!);
    sock.send(JSON.stringify({ channel: "chat", event: "join" }));
    await tick();
    sock.send(JSON.stringify({ channel: "chat", event: "one" }));
    sock.send(JSON.stringify({ channel: "chat", event: "leave" }));
    sock.send(JSON.stringify({ channel: "chat", event: "two" }));
    await tick();
    expect(handled).toEqual(["one"]);
    sock.close();
  } finally {
    server.stop(true);
  }
});

test("channels without a join hook still dispatch to handle", async () => {
  const handled: string[] = [];
  const feed = channel("feed", {
    handle: (_ws, event) => {
      handled.push(event);
    },
  });
  const server = serve({ port: 0, routes: [], websocket: { channels: [feed] } });
  try {
    const sock = await connect(server.port!);
    sock.send(JSON.stringify({ channel: "feed", event: "hello" }));
    await tick();
    expect(handled).toEqual(["hello"]);
    sock.close();
  } finally {
    server.stop(true);
  }
});

test("upgradeData exposes request headers to handlers as ws.data", async () => {
  let seen: unknown = null;
  const server = serve({
    port: 0,
    routes: [],
    websocket: {
      upgradeData: (req: Request) => ({ cookie: req.headers.get("cookie") }),
      onOpen: (ws: { data: unknown }) => {
        seen = ws.data;
      },
    },
  });
  try {
    const sock = await connect(server.port!, { cookie: "sid=abc" });
    await tick();
    expect(seen).toEqual({ cookie: "sid=abc" });
    sock.close();
  } finally {
    server.stop(true);
  }
});
