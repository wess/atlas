import { sign } from "../../auth/token/index.ts";
import { createMemoryRateLimit } from "../../security/ratelimit/index.ts";
import type { Conn, Route } from "../../server/index.ts";
import { del, get, json, parseJson, pipe, pipeline, post, putHeader } from "../../server/index.ts";
import { isSameOrigin, sessionClaims, sessionCookie } from "../auth/index.ts";
import type { AdminConfig } from "../config/index.ts";

const eightHours = 8 * 60 * 60;
const attemptsAllowed = 10;
const attemptWindowSeconds = 15 * 60;
// argon2 work scales with input, so an absurd password must not reach the verifier
const longestCredential = 1024;

const noStore = (conn: Conn) => putHeader(conn, "cache-control", "no-store");

const cookie = (base: string, value: string, maxAge: number) =>
  [
    `${sessionCookie}=${value}`,
    `Path=${base || "/"}`,
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Strict",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");

export const generateSessionRoutes = (config: AdminConfig): Route[] => {
  const base = config.basePath ?? "/admin";
  const auth = config.auth;
  const path = `${base}/session`;

  if (!auth) {
    return [
      get(
        path,
        pipe((c) => noStore(json(c, 200, { authRequired: false, authenticated: true, loginEnabled: false }))),
      ),
    ];
  }

  const login = auth.login;
  const lifetime = auth.sessionSeconds ?? eightHours;
  const attempts = auth.rateLimit ?? createMemoryRateLimit();

  const routes: Route[] = [
    // public on purpose: this is how the app decides whether to show the sign-in screen
    get(
      path,
      pipe(async (c) => {
        const claims = await sessionClaims(c, auth);
        const authenticated = claims ? await auth.authorize(claims) : false;
        return noStore(json(c, 200, { authRequired: true, authenticated, loginEnabled: Boolean(login) }));
      }),
    ),
    del(
      path,
      pipe((c) =>
        isSameOrigin(c, auth)
          ? noStore(putHeader(json(c, 200, { authenticated: false }), "set-cookie", cookie(base, "", 0)))
          : json(c, 403, { error: "Cross-origin request refused." }),
      ),
    ),
  ];

  if (!login) return routes;

  routes.push(
    post(
      path,
      pipeline(parseJson)(async (c) => {
        if (!isSameOrigin(c, auth)) return json(c, 403, { error: "Cross-origin request refused." });
        const { email, password } = (c.body ?? {}) as { email?: unknown; password?: unknown };
        if (
          typeof email !== "string" ||
          typeof password !== "string" ||
          !email ||
          !password ||
          email.length > longestCredential ||
          password.length > longestCredential
        ) {
          return json(c, 400, { error: "Enter your email and password." });
        }
        const bucket = `admin-login:${email.trim().toLowerCase()}`;
        const limit = await attempts.check(bucket, attemptsAllowed, attemptWindowSeconds);
        if (!limit.ok) {
          const minutes = Math.ceil(limit.retryAfterSeconds / 60);
          return putHeader(
            json(c, 429, { error: `Too many attempts for this account. Try again in ${minutes} minutes.` }),
            "retry-after",
            String(limit.retryAfterSeconds),
          );
        }
        const claims = await login({ email, password });
        if (!claims) return json(c, 401, { error: "That email and password don't match." });
        if (!(await auth.authorize(claims))) {
          return json(c, 403, { error: "This account doesn't have access to the admin." });
        }
        await attempts.reset(bucket);
        const value = await sign(claims, auth.secret, { expiresIn: lifetime });
        return noStore(putHeader(json(c, 200, { authenticated: true }), "set-cookie", cookie(base, value, lifetime)));
      }),
    ),
  );
  return routes;
};
