import { expect, test } from "bun:test";
import { raw } from "../fragment/index.ts";
import { from } from "../from/index.ts";
import { connectPostgres } from "../postgres/index.ts";

// needs a real server: ATLAS_TEST_POSTGRES_URL=postgres://user:pass@host:port/db
const url = process.env.ATLAS_TEST_POSTGRES_URL;
const pg = test.skipIf(!url);

const count = async (db: ReturnType<typeof connectPostgres>) =>
  (await db.one<{ n: number }>({ text: "select count(*)::int as n from atlas_stacked", values: [] }))!.n;

pg("a builder query with no values cannot run a second statement", async () => {
  const db = connectPostgres(url!, 1);
  try {
    await db.execute({ text: "drop table if exists atlas_stacked; create table atlas_stacked (v int)", values: [] });
    // the join `on` string is emitted verbatim, so it can still carry text
    const smuggled = from("atlas_stacked").join(
      "atlas_stacked",
      raw("true; insert into atlas_stacked values (1)"),
      "b",
    );
    await expect(db.all(smuggled)).rejects.toThrow(/multiple commands/);
    await expect(db.transaction((tx) => tx.all(smuggled))).rejects.toThrow(/multiple commands/);
    expect(await count(db)).toBe(0);
  } finally {
    await db.execute({ text: "drop table if exists atlas_stacked", values: [] });
    await db.close();
  }
});

pg("builder queries with and without values still run", async () => {
  const db = connectPostgres(url!, 1);
  try {
    await db.execute({ text: "drop table if exists atlas_stacked; create table atlas_stacked (v int)", values: [] });
    await db.execute(from("atlas_stacked").insert({ v: 7 }));
    expect(await db.all(from("atlas_stacked").select("v"))).toEqual([{ v: 7 }]);
    expect(await db.one(from("atlas_stacked").where((q) => q("v").equals(7)))).toEqual({ v: 7 });
    expect(await db.execute(from("atlas_stacked").update({ v: 8 }).returning("v"))).toEqual([{ v: 8 }]);
  } finally {
    await db.execute({ text: "drop table if exists atlas_stacked", values: [] });
    await db.close();
  }
});

pg("plain text queries keep multi-statement execution for migrations", async () => {
  const db = connectPostgres(url!, 1);
  try {
    await db.execute({
      text: "drop table if exists atlas_stacked; create table atlas_stacked (v int); insert into atlas_stacked values (1), (2)",
      values: [],
    });
    expect(await count(db)).toBe(2);
  } finally {
    await db.execute({ text: "drop table if exists atlas_stacked", values: [] });
    await db.close();
  }
});
