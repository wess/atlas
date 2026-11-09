import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "../../db/index.ts";
import { up } from "../migrations/index.ts";
import { splitSqlite } from "../migrations/statements.ts";

test("splits on semicolons outside quotes, comments, and trigger bodies", () => {
  const sql = `
    CREATE TABLE a (id INTEGER, note TEXT DEFAULT 'x; y');
    -- a comment; not a statement
    /* nor; this */
    CREATE INDEX "a;idx" ON a (id);
    CREATE TRIGGER t AFTER INSERT ON a BEGIN
      UPDATE a SET note = CASE WHEN note IS NULL THEN 'n' ELSE note END;
      INSERT INTO a (id) VALUES (0);
    END;
    INSERT INTO a (id, note) VALUES (1, 'it''s; fine')
  `;
  const parts = splitSqlite(sql);
  expect(parts).toHaveLength(4);
  expect(parts[0]).toStartWith("CREATE TABLE a");
  expect(parts[1]).toContain("CREATE INDEX");
  expect(parts[2]).toStartWith("CREATE TRIGGER");
  expect(parts[2]).toEndWith("END");
  expect(parts[3]).toContain("it''s; fine");
  expect(splitSqlite("-- only a comment\n")).toEqual([]);
});

test("sqlite migrations run every statement, atomically", async () => {
  const dir = mkdtempSync(join(tmpdir(), "atlasmulti"));
  const db = connect({ driver: "sqlite", path: ":memory:" });
  try {
    await Bun.write(
      join(dir, "20260101000000_first/up.sql"),
      "CREATE TABLE a (id INTEGER);\nCREATE UNIQUE INDEX a_id ON a (id);\n",
    );
    await Bun.write(join(dir, "20260101000000_first/down.sql"), "DROP TABLE a;");
    expect(await up(db, dir)).toEqual(["20260101000000_first"]);
    await db.execute({ text: "INSERT INTO a (id) VALUES (1)", values: [] });
    await expect(db.execute({ text: "INSERT INTO a (id) VALUES (1)", values: [] })).rejects.toThrow();

    await Bun.write(join(dir, "20260102000000_broken/up.sql"), "CREATE TABLE b (id INTEGER);\nNOT VALID SQL;\n");
    await Bun.write(join(dir, "20260102000000_broken/down.sql"), "DROP TABLE b;");
    await expect(up(db, dir)).rejects.toThrow();
    expect(await db.one({ text: "SELECT name FROM sqlite_master WHERE name = 'b'", values: [] })).toBeNull();
    expect(
      await db.one({ text: "SELECT name FROM schema_migrations WHERE name = '20260102000000_broken'", values: [] }),
    ).toBeNull();
  } finally {
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
