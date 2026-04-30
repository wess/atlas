import { expect, test } from "bun:test";
import { token } from "@atlas/auth";
import { connect } from "@atlas/db";
import { createSessionStore } from "../sessions";

const newDb = async () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  await db.execute({
    text: `CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      ip TEXT, user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    )`,
    values: [],
  });
  return db;
};

const SECRET = "test-secret";

test("issue creates a session row and returns a JWT containing the jti", async () => {
  const db = await newDb();
  const store = createSessionStore<{ id: number; email: string }>({ db, secret: SECRET });
  const issued = await store.issue({ id: 7, email: "a@b" }, { ip: "1.2.3.4", userAgent: "ua" });
  expect(issued.token.length).toBeGreaterThan(0);
  expect(issued.jti.length).toBeGreaterThan(0);
  const payload = (await token.verify(issued.token, SECRET)) as { jti: string; id: number; email: string };
  expect(payload.jti).toBe(issued.jti);
  expect(payload.id).toBe(7);
  expect(payload.email).toBe("a@b");
  await db.close();
});

test("isActive returns true for a fresh session", async () => {
  const db = await newDb();
  const store = createSessionStore<{ id: number }>({ db, secret: SECRET });
  const { jti } = await store.issue({ id: 1 });
  const status = await store.isActive(jti);
  expect(status.active).toBe(true);
  expect(status.userId).toBe(1);
  await db.close();
});

test("isActive returns false for an unknown jti", async () => {
  const db = await newDb();
  const store = createSessionStore<{ id: number }>({ db, secret: SECRET });
  const status = await store.isActive("nonexistent");
  expect(status.active).toBe(false);
  expect(status.userId).toBeUndefined();
  await db.close();
});

test("revoke marks the session inactive", async () => {
  const db = await newDb();
  const store = createSessionStore<{ id: number }>({ db, secret: SECRET });
  const { jti } = await store.issue({ id: 1 });
  expect(await store.revoke(jti, 1)).toBe(true);
  const status = await store.isActive(jti);
  expect(status.active).toBe(false);
  // Re-revoking returns false.
  expect(await store.revoke(jti, 1)).toBe(false);
  await db.close();
});

test("revoke fails for the wrong user", async () => {
  const db = await newDb();
  const store = createSessionStore<{ id: number }>({ db, secret: SECRET });
  const { jti } = await store.issue({ id: 1 });
  expect(await store.revoke(jti, 999)).toBe(false);
  expect((await store.isActive(jti)).active).toBe(true);
  await db.close();
});

test("revokeAll kills every active session for a user", async () => {
  const db = await newDb();
  const store = createSessionStore<{ id: number }>({ db, secret: SECRET });
  await store.issue({ id: 1 });
  await store.issue({ id: 1 });
  await store.issue({ id: 2 });
  const killed = await store.revokeAll(1);
  expect(killed).toBe(2);
  await db.close();
});

test("revokeAll keeps the exception jti alive", async () => {
  const db = await newDb();
  const store = createSessionStore<{ id: number }>({ db, secret: SECRET });
  const a = await store.issue({ id: 1 });
  const b = await store.issue({ id: 1 });
  await store.revokeAll(1, b.jti);
  expect((await store.isActive(a.jti)).active).toBe(false);
  expect((await store.isActive(b.jti)).active).toBe(true);
  await db.close();
});

test("isActive returns false for an expired session", async () => {
  const db = await newDb();
  const store = createSessionStore<{ id: number }>({ db, secret: SECRET, ttlSeconds: -1 });
  const { jti } = await store.issue({ id: 1 });
  expect((await store.isActive(jti)).active).toBe(false);
  await db.close();
});

test("sweepExpired deletes sessions whose expires_at has passed", async () => {
  const db = await newDb();
  const store = createSessionStore<{ id: number }>({ db, secret: SECRET, ttlSeconds: -1 });
  await store.issue({ id: 1 });
  await store.issue({ id: 2 });
  await store.sweepExpired();
  const rows = (await db.execute({ text: "SELECT COUNT(*) AS n FROM sessions", values: [] })) as Array<{ n: number }>;
  expect(rows[0]?.n).toBe(0);
  await db.close();
});

test("custom payload builder shapes the JWT claims", async () => {
  const db = await newDb();
  const store = createSessionStore<{ id: number; secretField: string }>({
    db,
    secret: SECRET,
    payload: (u) => ({ id: u.id }), // omit secretField
  });
  const { token: jwt } = await store.issue({ id: 1, secretField: "do-not-leak" });
  const payload = await token.verify(jwt, SECRET);
  expect(payload.id).toBe(1);
  expect((payload as { secretField?: string }).secretField).toBeUndefined();
  await db.close();
});
