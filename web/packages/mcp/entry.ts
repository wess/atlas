#!/usr/bin/env bun

import { createContext } from "./context/index.ts";
import { createMcpServer } from "./server/index.ts";
import { collectTools } from "./tools/index.ts";

const loadProjectContext = async () => {
  const ctx: Record<string, unknown> = {};

  if (Bun.env.DATABASE_URL) {
    const { connect } = await import("@atlas/db");
    ctx.db = connect({ driver: "postgres", url: Bun.env.DATABASE_URL });
  } else if (Bun.env.DATABASE_PATH) {
    const { connect } = await import("@atlas/db");
    ctx.db = connect({ driver: "sqlite", path: Bun.env.DATABASE_PATH });
  }

  if (Bun.env.REDIS_URL) {
    const { createCache } = await import("@atlas/cache");
    ctx.cache = createCache({ url: Bun.env.REDIS_URL });
  }

  if (Bun.env.S3_ENDPOINT) {
    ctx.storage = {
      endpoint: Bun.env.S3_ENDPOINT,
      bucket: Bun.env.S3_BUCKET ?? "default",
      accessKey: Bun.env.S3_ACCESS_KEY ?? "",
      secretKey: Bun.env.S3_SECRET_KEY ?? "",
      region: Bun.env.S3_REGION ?? "us-east-1",
    };
  }

  ctx.migrationsDir = "./migrations";
  ctx.logBuffer = [] as string[];

  return createContext(ctx);
};

const ctx = await loadProjectContext();
const tools = collectTools(ctx);
const server = createMcpServer(tools, ctx);
await server.start();
