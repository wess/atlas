import { expect, test } from "bun:test";
import { connectPostgres } from "../postgres/index.ts";

// needs a real server: ATLAS_TEST_POSTGRES_URL=postgres://user:pass@host:port/db
const url = process.env.ATLAS_TEST_POSTGRES_URL;
const pg = test.skipIf(!url);

const count = async (db: ReturnType<typeof connectPostgres>) =>
  (await db.one<{ n: number }>({ text: "select count(*)::int as n from atlas_nested", values: [] }))!.n;

const insert = (db: ReturnType<typeof connectPostgres>, v: number) =>
  db.execute({ text: "insert into atlas_nested (v) values ($1)", values: [v] });

pg("nested transaction uses a savepoint and composes", async () => {
  const db = connectPostgres(url!, 1);
  try {
    await db.execute({ text: "drop table if exists atlas_nested", values: [] });
    await db.execute({ text: "create table atlas_nested (v int)", values: [] });

    await db.transaction(async (tx) => {
      await insert(tx, 1);
      await tx.transaction(async (inner) => {
        await insert(inner, 2);
        await inner.transaction(async (deep) => insert(deep, 3));
      });
      // inner failure rolls back to the savepoint only
      await tx
        .transaction(async (inner) => {
          await insert(inner, 4);
          throw new Error("boom");
        })
        .catch(() => {});
      await insert(tx, 5);
    });
    expect(await count(db)).toBe(4);

    await db
      .transaction(async (tx) => {
        await insert(tx, 6);
        await tx.transaction(async (inner) => insert(inner, 7));
        throw new Error("outer");
      })
      .catch(() => {});
    expect(await count(db)).toBe(4);
  } finally {
    await db.execute({ text: "drop table if exists atlas_nested", values: [] });
    await db.close();
  }
});
