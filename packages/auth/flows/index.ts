import type { Connection } from "@atlas/db";
import { from } from "@atlas/db";
import type { Conn, PipeFn } from "@atlas/server";
import { assign, halt, json } from "@atlas/server";
import { hash, verify as verifyPassword } from "../password/index.ts";
import * as token from "../token/index.ts";

type SignupOptions = {
  readonly db: Connection;
  readonly table: string;
  readonly fields: readonly string[];
  readonly onSuccess: (conn: Conn, user: Record<string, unknown>) => Conn | Promise<Conn>;
};

export const signup =
  (opts: SignupOptions): PipeFn =>
  async (conn: Conn) => {
    const body = conn.body as Record<string, unknown> | undefined;
    if (!body) return halt(conn, 400, { error: "Missing request body" });

    const record: Record<string, unknown> = {};
    for (const field of opts.fields) {
      const value = body[field];
      if (value === undefined || value === null) {
        return halt(conn, 422, { error: `Missing field: ${field}` });
      }
      record[field] = field === "password" ? await hash(String(value)) : value;
    }

    const query = from(opts.table).insert(record);
    const rows = await opts.db.execute(query);
    const user = rows[0] ?? record;

    return opts.onSuccess(conn, user);
  };

type LoginOptions = {
  readonly db: Connection;
  readonly table: string;
  readonly identity: string;
  readonly password: string;
  readonly onSuccess: (conn: Conn, user: Record<string, unknown>) => Conn | Promise<Conn>;
};

export const login =
  (opts: LoginOptions): PipeFn =>
  async (conn: Conn) => {
    const body = conn.body as Record<string, unknown> | undefined;
    if (!body) return halt(conn, 400, { error: "Missing request body" });

    const identityValue = body[opts.identity];
    const passwordValue = body[opts.password];

    if (!identityValue || !passwordValue) {
      return halt(conn, 422, { error: "Missing credentials" });
    }

    const query = from(opts.table).where(opts.identity, "=", identityValue);
    const user = (await opts.db.one(query)) as Record<string, unknown> | null;
    if (!user) return halt(conn, 401, { error: "Invalid credentials" });

    const valid = await verifyPassword(String(passwordValue), String(user[opts.password]));
    if (!valid) return halt(conn, 401, { error: "Invalid credentials" });

    return opts.onSuccess(conn, user);
  };

type RequireAuthOptions = {
  readonly secret: string;
};

export const requireAuth =
  (opts: RequireAuthOptions): PipeFn =>
  async (conn: Conn) => {
    const authHeader = conn.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return halt(conn, 401, { error: "Missing or invalid authorization header" });
    }

    const jwt = authHeader.slice(7);
    try {
      const payload = await token.verify(jwt, opts.secret);
      return assign(conn, { auth: payload });
    } catch {
      return halt(conn, 401, { error: "Invalid or expired token" });
    }
  };

type PasswordResetOptions = {
  readonly db: Connection;
  readonly table: string;
  readonly transport: (email: string, resetToken: string) => Promise<void>;
};

export const passwordReset =
  (opts: PasswordResetOptions): PipeFn =>
  async (conn: Conn) => {
    const body = conn.body as Record<string, unknown> | undefined;
    if (!body) return halt(conn, 400, { error: "Missing request body" });

    const email = body.email as string | undefined;
    if (!email) return halt(conn, 422, { error: "Missing email field" });

    const query = from(opts.table).where("email", "=", email);
    const user = await opts.db.one(query);

    if (!user) {
      return json(conn, 200, { message: "If the email exists, a reset link has been sent" });
    }

    const resetToken = await token.sign({ email, purpose: "password_reset" }, crypto.randomUUID(), { expiresIn: 3600 });
    await opts.transport(email, resetToken);

    return json(conn, 200, { message: "If the email exists, a reset link has been sent" });
  };
