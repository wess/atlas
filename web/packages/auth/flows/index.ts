import { createHmac, timingSafeEqual } from "node:crypto";
import type { Connection, Schema, SchemaColumns } from "../../db/query.ts";
import { from } from "../../db/query.ts";
import type { Conn, PipeFn } from "../../server/index.ts";
import { assign, halt, json } from "../../server/index.ts";
import { hash, verify as verifyPassword } from "../password/index.ts";
import * as token from "../token/index.ts";

type SignupOptions = {
  readonly db: Connection;
  readonly table: string | Schema<SchemaColumns>;
  readonly fields: readonly string[];
  readonly onSuccess: (conn: Conn, user: Record<string, unknown>) => Conn | Promise<Conn>;
};

// a missing account still pays for one argon2 verify, so response time doesn't reveal which emails exist
let dummyHash: Promise<string> | undefined;
const missingAccountHash = (): Promise<string> => {
  dummyHash ??= hash(crypto.randomUUID());
  return dummyHash;
};

/**
 * Registration pipe. A duplicate answers 409, which tells the caller the
 * account exists; put signup behind a rate limit, or answer generically and
 * notify the address out of band, if that matters for your app.
 */
export const signup =
  (opts: SignupOptions): PipeFn =>
  async (conn: Conn) => {
    const body = conn.body as Record<string, unknown> | undefined;
    if (!body)
      return halt(conn, 400, { error: "Missing request body. Send a JSON body with Content-Type: application/json." });

    const record: Record<string, unknown> = {};
    for (const field of opts.fields) {
      const value = body[field];
      if (value === undefined || value === null) {
        return halt(conn, 422, { error: `Missing required field: ${field}. Include it in the JSON request body.` });
      }
      record[field] = field === "password" ? await hash(String(value)) : value;
    }

    const query = from(opts.table).insert(record).returning("*");
    let rows: any[];
    try {
      rows = await opts.db.execute(query);
    } catch (err: any) {
      if (
        err?.code === "SQLITE_CONSTRAINT_UNIQUE" ||
        err?.message?.includes("unique") ||
        err?.message?.includes("duplicate")
      ) {
        return halt(conn, 409, { error: "An account with these details already exists." });
      }
      throw err;
    }
    const { password: _hash, ...user } = rows[0] ?? record;

    return opts.onSuccess(conn, user);
  };

type LoginOptions = {
  readonly db: Connection;
  readonly table: string | Schema<SchemaColumns>;
  readonly identity: string;
  readonly password: string;
  readonly onSuccess: (conn: Conn, user: Record<string, unknown>) => Conn | Promise<Conn>;
};

export const login =
  (opts: LoginOptions): PipeFn =>
  async (conn: Conn) => {
    const body = conn.body as Record<string, unknown> | undefined;
    if (!body)
      return halt(conn, 400, { error: "Missing request body. Send a JSON body with Content-Type: application/json." });

    const identityValue = body[opts.identity];
    const passwordValue = body[opts.password];

    if (!identityValue || !passwordValue) {
      return halt(conn, 422, {
        error: `Missing credentials. Send both '${opts.identity}' and '${opts.password}' in the JSON body.`,
      });
    }

    const query = from(opts.table).where((q) => q(opts.identity).equals(identityValue));
    const user = (await opts.db.one(query)) as Record<string, unknown> | null;
    const stored = user?.[opts.password];
    const valid = await verifyPassword(
      String(passwordValue),
      user && typeof stored === "string" && stored ? stored : await missingAccountHash(),
    ).catch(() => false);
    if (!user || !valid) return halt(conn, 401, { error: "Invalid credentials" });

    const { [opts.password]: _hash, ...safe } = user;
    return opts.onSuccess(conn, safe);
  };

type RequireAuthOptions = {
  readonly secret: string;
  /**
   * Accept OAuth access tokens (`typ: at+jwt`, or `client_id` + `scope`
   * claims) minted by `@wess/atlas/oauth` with this same secret. Off by
   * default: those tokens are scoped grants held by third-party clients, not
   * the user's own session. Turn it on only for an API meant for OAuth
   * clients, and check `conn.assigns.auth.scope` there.
   */
  readonly acceptAccessTokens?: boolean;
};

/**
 * True when a verified token is a user session: not an OAuth access token
 * (unless `acceptAccessTokens`) and not a single-purpose token such as a
 * password reset, which carry a `purpose` claim.
 */
export const isSessionToken = (
  jwt: string,
  claims: Record<string, unknown>,
  opts: { readonly acceptAccessTokens?: boolean } = {},
): boolean => {
  if (claims.purpose !== undefined) return false;
  if (!opts.acceptAccessTokens && token.isAccessToken(token.headerOf(jwt), claims)) return false;
  return true;
};

export const requireAuth =
  (opts: RequireAuthOptions): PipeFn =>
  async (conn: Conn) => {
    const authHeader = conn.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return halt(conn, 401, {
        error: "Missing or invalid authorization header. Send 'Authorization: Bearer <token>' with a valid JWT.",
      });
    }

    const jwt = authHeader.slice(7);
    try {
      const payload = await token.verify(jwt, opts.secret);
      if (!isSessionToken(jwt, payload, opts)) throw new Error("not a session token");
      return assign(conn, { auth: payload });
    } catch {
      return halt(conn, 401, {
        error: "Invalid or expired token. The token could not be verified. Re-authenticate to get a fresh token.",
      });
    }
  };

type PasswordResetOptions = {
  readonly db: Connection;
  readonly table: string | Schema<SchemaColumns>;
  /**
   * Secret used to sign the reset JWT. The endpoint that consumes the token
   * must verify with the same secret — typically a dedicated env var like
   * `PASSWORD_RESET_SECRET` so revoking it invalidates all outstanding resets
   * without affecting login sessions.
   */
  readonly secret: string;
  /** Token TTL in seconds. Default: 3600 (1 hour). */
  readonly expiresIn?: number;
  /** Column holding the password hash, bound into the token. Default: `password`. */
  readonly passwordField?: string;
  /**
   * Delivers the token. Not awaited, so a slow or failing transport can't
   * reveal whether the address has an account; failures are logged.
   */
  readonly transport: (email: string, resetToken: string) => Promise<void>;
};

const PASSWORD_RESET = "password_reset";

/**
 * Short keyed fingerprint of the current password hash. A reset token carries
 * it, so the token dies as soon as the password changes: it can be used once,
 * and every outstanding reset link stops working after any password change.
 */
export const passwordFingerprint = (secret: string, passwordHash: string): string =>
  createHmac("sha256", secret).update(`${PASSWORD_RESET}:${passwordHash}`).digest("base64url").slice(0, 22);

/**
 * Check a token from `passwordReset` before accepting a new password.
 * `currentHash` looks up the account's stored password hash by email (null
 * when the account is gone). Throws unless the token is a valid, unexpired
 * reset token whose fingerprint matches the current hash; returns the email.
 */
export const verifyPasswordReset = async (
  resetToken: string,
  secret: string,
  currentHash: (email: string) => Promise<string | null | undefined> | string | null | undefined,
): Promise<{ readonly email: string }> => {
  const claims = await token.verify(resetToken, secret);
  const fingerprint = claims.pwd;
  if (claims.purpose !== PASSWORD_RESET || typeof claims.email !== "string" || typeof fingerprint !== "string") {
    throw new Error("Not a password reset token");
  }
  const stored = await currentHash(claims.email);
  if (typeof stored !== "string") throw new Error("Password reset token is no longer valid");
  const expected = Buffer.from(passwordFingerprint(secret, stored));
  const actual = Buffer.from(fingerprint);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Password reset token is no longer valid");
  }
  return { email: claims.email };
};

export const passwordReset =
  (opts: PasswordResetOptions): PipeFn =>
  async (conn: Conn) => {
    const body = conn.body as Record<string, unknown> | undefined;
    if (!body)
      return halt(conn, 400, { error: "Missing request body. Send a JSON body with Content-Type: application/json." });

    const email = body.email as string | undefined;
    if (!email) return halt(conn, 422, { error: "Missing 'email' field in request body." });

    const query = from(opts.table).where((q) => q("email").equals(email));
    const user = (await opts.db.one(query)) as Record<string, unknown> | null;
    const stored = user?.[opts.passwordField ?? "password"];
    // sign either way so both answers cost the same
    const resetToken = await token.sign(
      {
        email,
        purpose: PASSWORD_RESET,
        pwd: passwordFingerprint(opts.secret, typeof stored === "string" ? stored : ""),
      },
      opts.secret,
      { expiresIn: opts.expiresIn ?? 3600 },
    );
    if (user) {
      const failed = (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[auth] password reset delivery failed:", message.replaceAll(resetToken, "[token]"));
      };
      try {
        opts.transport(email, resetToken).catch(failed);
      } catch (err) {
        failed(err);
      }
    }

    return json(conn, 200, { message: "If the email exists, a reset link has been sent" });
  };
