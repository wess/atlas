import { requireAuth } from "../../auth/index.ts";
import type { PipeFn } from "../../server/index.ts";
import { halt, pipeline } from "../../server/index.ts";
import type { AdminConfig } from "../config/index.ts";

export const adminAuth = (config: AdminConfig): ((handler: PipeFn) => PipeFn) => {
  const auth = config.auth;
  if (!auth) {
    if (!config.allowUnauthenticated || process.env.NODE_ENV === "production")
      throw new Error("Admin routes require authentication");
    return (handler) => handler;
  }
  if (typeof auth.authorize !== "function") throw new Error("Admin auth requires an authorization predicate");
  return pipeline(requireAuth(auth), async (conn) =>
    (await auth.authorize(conn.assigns.auth as Record<string, unknown>))
      ? conn
      : halt(conn, 403, { error: "Forbidden" }),
  );
};
