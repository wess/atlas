import { expect, test } from "bun:test";
import { connect } from "@atlas/db";
import { createAuditLogger } from "../audit";

const newDb = async () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  await db.execute({
    text: `CREATE TABLE audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event TEXT NOT NULL,
      metadata TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    values: [],
  });
  return db;
};

const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));

test("logs an event with metadata", async () => {
  const db = await newDb();
  const audit = createAuditLogger({ db });
  audit.log({ userId: 1, event: "user.login", metadata: { ok: true }, ip: "1.2.3.4", userAgent: "ua" });
  await wait();
  const rows = (await db.execute({
    text: "SELECT user_id, event, metadata, ip, user_agent FROM audit_events",
    values: [],
  })) as Array<{ user_id: number; event: string; metadata: string; ip: string; user_agent: string }>;
  expect(rows).toHaveLength(1);
  expect(rows[0]?.user_id).toBe(1);
  expect(rows[0]?.event).toBe("user.login");
  expect(JSON.parse(rows[0]?.metadata ?? "")).toEqual({ ok: true });
  expect(rows[0]?.ip).toBe("1.2.3.4");
  await db.close();
});

test("missing fields default to null", async () => {
  const db = await newDb();
  const audit = createAuditLogger({ db });
  audit.log({ event: "system.boot" });
  await wait();
  const rows = (await db.execute({
    text: "SELECT user_id, metadata, ip FROM audit_events WHERE event = 'system.boot'",
    values: [],
  })) as Array<{ user_id: number | null; metadata: string | null; ip: string | null }>;
  expect(rows[0]?.user_id).toBeNull();
  expect(rows[0]?.metadata).toBeNull();
  expect(rows[0]?.ip).toBeNull();
  await db.close();
});

test("custom table name is honored", async () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  await db.execute({
    text: `CREATE TABLE my_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER, event TEXT NOT NULL, metadata TEXT, ip TEXT, user_agent TEXT
    )`,
    values: [],
  });
  const audit = createAuditLogger({ db, table: "my_events" });
  audit.log({ event: "x" });
  await wait();
  const rows = (await db.execute({ text: "SELECT COUNT(*) AS n FROM my_events", values: [] })) as Array<{ n: number }>;
  expect(rows[0]?.n).toBe(1);
  await db.close();
});

test("DB error invokes onError, never throws", async () => {
  const db = connect({ driver: "sqlite", path: ":memory:" });
  // Intentionally don't create the table — every insert will fail.
  const errors: Array<{ event: string }> = [];
  const audit = createAuditLogger({
    db,
    onError: (_err, ev) => errors.push({ event: ev.event }),
  });
  // Should NOT throw even though the table is missing.
  expect(() => audit.log({ event: "broken" })).not.toThrow();
  await wait();
  expect(errors).toHaveLength(1);
  expect(errors[0]?.event).toBe("broken");
  await db.close();
});
