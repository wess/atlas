import { isSessionToken, requireAuth } from "../../auth/flows/index.ts";
import { verify } from "../../auth/token/index.ts";
import type { Conn, PipeFn } from "../../server/index.ts";
import { assign, halt, pipeline } from "../../server/index.ts";
import type { AdminConfig } from "../config/index.ts";
import { createMemoryRevocations, type Revocations } from "../revocations/index.ts";

export const sessionCookie = "atlas_admin_session";

export const readCookie = (header: string | null, name: string): string | undefined => {
  for (const part of header?.split(";") ?? []) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return undefined;
};

type AdminAuth = NonNullable<AdminConfig["auth"]>;

// a cookie is sent ambiently, so a write has to prove the page making it is ours. every browser sends
// Origin on these methods; a client without one has no ambient cookie to protect and should use Bearer.
export const isSameOrigin = (conn: Conn, auth: AdminAuth): boolean => {
  const origin = conn.headers.get("origin");
  if (!origin) return false;
  if (auth.trustedOrigins?.includes(origin)) return true;
  try {
    return new URL(origin).host === conn.headers.get("host");
  } catch {
    return false;
  }
};

const defaultRevocations = new WeakMap<AdminAuth, Revocations>();

// one store per admin config, so every route of the same admin sees the same sign-outs
export const revocationsFor = (auth: AdminAuth): Revocations => {
  if (auth.revocations) return auth.revocations;
  let store = defaultRevocations.get(auth);
  if (!store) {
    store = createMemoryRevocations();
    defaultRevocations.set(auth, store);
  }
  return store;
};

export const sessionClaims = async (conn: Conn, auth: AdminAuth): Promise<Record<string, unknown> | null> => {
  const session = readCookie(conn.headers.get("cookie"), sessionCookie);
  if (!session) return null;
  let claims: Record<string, unknown>;
  try {
    claims = (await verify(session, auth.secret)) as Record<string, unknown>;
  } catch {
    return null;
  }
  // an OAuth access token or reset token signed with the same secret is not an admin session
  if (!isSessionToken(session, claims)) return null;
  // a cookie without an id can never be signed out, so it isn't accepted as a session
  if (typeof claims.jti !== "string" || (await revocationsFor(auth).isRevoked(claims.jti))) return null;
  return claims;
};

const readMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const adminAuth = (config: AdminConfig): ((handler: PipeFn) => PipeFn) => {
  const auth = config.auth;
  if (!auth) {
    if (!config.allowUnauthenticated || process.env.NODE_ENV === "production")
      throw new Error("Admin routes require authentication");
    return (handler) => handler;
  }
  if (typeof auth.authorize !== "function") throw new Error("Admin auth requires an authorization predicate");
  // never accepts OAuth access tokens: a third-party grant must not act as the admin
  const bearer = requireAuth({ secret: auth.secret });
  const authenticate: PipeFn = async (conn) => {
    if (conn.headers.has("authorization") || !readCookie(conn.headers.get("cookie"), sessionCookie))
      return bearer(conn);
    if (!readMethods.has(conn.method) && !isSameOrigin(conn, auth)) {
      return halt(conn, 403, { error: "Cross-origin request refused. Reload the admin from its own address." });
    }
    const claims = await sessionClaims(conn, auth);
    if (!claims) return halt(conn, 401, { error: "Your session has expired. Sign in again." });
    return assign(conn, { auth: claims });
  };
  return pipeline(authenticate, async (conn) =>
    (await auth.authorize(conn.assigns.auth as Record<string, unknown>))
      ? conn
      : halt(conn, 403, { error: "Forbidden" }),
  );
};
