import { expect, test } from "bun:test";
import type { ConnectOptions } from "../drivers/types.ts";

test("ConnectOptions type accepts postgres config", () => {
  const opts: ConnectOptions = { driver: "postgres", url: "postgres://localhost/test", pool: 5 };
  expect(opts.driver).toBe("postgres");
});

test("ConnectOptions type accepts sqlite config", () => {
  const opts: ConnectOptions = { driver: "sqlite", path: "./test.db" };
  expect(opts.driver).toBe("sqlite");
});
