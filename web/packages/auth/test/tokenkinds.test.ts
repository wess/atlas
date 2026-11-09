import { afterEach, expect, spyOn, test } from "bun:test";
import { connect } from "../../db/index.ts";
import { createConn } from "../../server/index.ts";
import {
  isSessionToken,
  login,
  passwordFingerprint,
  passwordReset,
  requireAuth,
  verifyPasswordReset,
} from "../flows/index.ts";
import { hash } from "../password/index.ts";
import { createState } from "../social/state/index.ts";
import * as token from "../token/index.ts";

const SECRET = "shared-app-secret";

const bearer = (jwt: string) =>
  createConn(new Request("http://localhost/me", { headers: { authorization: `Bearer ${jwt}` } }));

const spies: { mockRestore: () => void }[] = [];
afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore();
});
const quiet = () => {
  const spy = spyOn(console, "error").mockImplementation(() => {});
  spies.push(spy);
  return spy;
};

test("requireAuth refuses an OAuth access token signed with the same secret", async () => {
  // what @wess/atlas/oauth mints when cfg.secret is the app secret
  const accessToken = await token.sign({ id: 1, client_id: "cli_x", scope: "read", jti: "j" }, SECRET, {
    expiresIn: 3600,
    typ: token.ACCESS_TOKEN_TYP,
  });
  expect(token.headerOf(accessToken).typ).toBe("at+jwt");
  expect((await token.verify(accessToken, SECRET)).id).toBe(1);
  const result = await requireAuth({ secret: SECRET })(bearer(accessToken));
  expect(result.status).toBe(401);
});

test("requireAuth refuses access tokens minted before the at+jwt header", async () => {
  const legacy = await token.sign({ id: 1, client_id: "cli_x", scope: "read" }, SECRET, { expiresIn: 3600 });
  expect((await requireAuth({ secret: SECRET })(bearer(legacy))).status).toBe(401);
});

test("acceptAccessTokens lets an OAuth resource API take them", async () => {
  const accessToken = await token.sign({ id: 1, client_id: "cli_x", scope: "read" }, SECRET, {
    expiresIn: 3600,
    typ: token.ACCESS_TOKEN_TYP,
  });
  const result = await requireAuth({ secret: SECRET, acceptAccessTokens: true })(bearer(accessToken));
  expect(result.halted).toBe(false);
  expect((result.assigns.auth as { scope: string }).scope).toBe("read");
});

test("requireAuth refuses purpose tokens: password resets and social state", async () => {
  const reset = await token.sign({ email: "a@b.c", purpose: "password_reset" }, SECRET, { expiresIn: 3600 });
  expect((await requireAuth({ secret: SECRET })(bearer(reset))).status).toBe(401);
  const { stateToken } = await createState(SECRET, "github");
  expect((await requireAuth({ secret: SECRET })(bearer(stateToken))).status).toBe(401);
});

test("plain session tokens still pass", async () => {
  const session = await token.sign({ id: 1, role: "admin" }, SECRET, { expiresIn: 3600 });
  expect(isSessionToken(session, await token.verify(session, SECRET))).toBe(true);
  const result = await requireAuth({ secret: SECRET })(bearer(session));
  expect((result.assigns.auth as { id: number }).id).toBe(1);
});

const usersDb = async () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  await db.execute({
    text: "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, password TEXT)",
    values: [],
  });
  await db.execute({
    text: "INSERT INTO users (email, password) VALUES (?, ?)",
    values: ["real@x.y", await hash("right-password")],
  });
  return db;
};

test("login runs a password verify even when the account doesn't exist", async () => {
  const db = await usersDb();
  const verify = spyOn(Bun.password, "verify");
  spies.push(verify);
  const pipe = login({ db, table: "users", identity: "email", password: "password", onSuccess: (c) => c });
  const conn = (email: string) => ({
    ...createConn(new Request("http://x", { method: "POST" })),
    body: { email, password: "wrong" },
  });
  const missing = await pipe(conn("nobody@x.y"));
  expect(missing.status).toBe(401);
  expect(verify).toHaveBeenCalledTimes(1);
  const wrong = await pipe(conn("real@x.y"));
  expect(wrong.status).toBe(401);
  expect(verify).toHaveBeenCalledTimes(2);
  expect(missing.body).toEqual(wrong.body);
  await db.close();
});

test("passwordReset answers without waiting for the transport and keeps the token out of logs", async () => {
  const db = await usersDb();
  const logged = quiet();
  let sent = "";
  const pending = passwordReset({
    db,
    table: "users",
    secret: SECRET,
    // never settles: an awaited transport would hang the response
    transport: (_email, resetToken) => {
      sent = resetToken;
      return new Promise(() => {});
    },
  });
  const conn = (email: string) => ({ ...createConn(new Request("http://x", { method: "POST" })), body: { email } });
  const real = await pending(conn("real@x.y"));
  const missing = await pending(conn("nobody@x.y"));
  expect(real.status).toBe(200);
  expect(real.body).toEqual(missing.body);
  expect(sent).not.toBe("");

  const failing = passwordReset({
    db,
    table: "users",
    secret: SECRET,
    transport: async (_email, resetToken) => {
      throw new Error(`smtp refused message containing ${resetToken}`);
    },
  });
  expect((await failing(conn("real@x.y"))).status).toBe(200);
  await Bun.sleep(0);
  expect(logged).toHaveBeenCalled();
  const output = logged.mock.calls.flat().join(" ");
  expect(output).toContain("[token]");
  expect(output).not.toContain(sent.split(".")[0]!);
  await db.close();
});

test("a reset token is bound to the password hash it was issued against", async () => {
  const db = await usersDb();
  let sent = "";
  await passwordReset({
    db,
    table: "users",
    secret: SECRET,
    transport: async (_email, resetToken) => {
      sent = resetToken;
    },
  })({ ...createConn(new Request("http://x", { method: "POST" })), body: { email: "real@x.y" } });
  const row = (await db.one({ text: "SELECT password FROM users", values: [] })) as { password: string };
  const claims = await token.verify(sent, SECRET);
  expect(claims.pwd).toBe(passwordFingerprint(SECRET, row.password));

  expect(await verifyPasswordReset(sent, SECRET, () => row.password)).toEqual({ email: "real@x.y" });
  // after the password changes, the same link is dead
  const changed = await hash("new-password");
  await expect(verifyPasswordReset(sent, SECRET, () => changed)).rejects.toThrow();
  await expect(verifyPasswordReset(sent, SECRET, () => null)).rejects.toThrow();
  // a session token is not a reset token
  const session = await token.sign({ email: "real@x.y" }, SECRET, { expiresIn: 60 });
  await expect(verifyPasswordReset(session, SECRET, () => row.password)).rejects.toThrow();
  await db.close();
});
